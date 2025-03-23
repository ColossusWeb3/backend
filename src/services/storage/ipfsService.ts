import lighthouse from '@lighthouse-web3/sdk';
import fs from 'fs';
import path from 'path';
import { config } from '../../config/config';
import { UploadFile } from '../../types';

/**
 * Service for interacting with IPFS via Lighthouse
 */
export class IPFSService {
  private apiKey: string;

  constructor() {
    this.apiKey = config.lighthouse.apiKey;
  }

  /**
   * Upload a file to IPFS
   * @param filePath Path to the file to upload
   * @returns CID of the uploaded file
   */
  async uploadFile(filePath: string): Promise<string> {
    try {
      const response = await lighthouse.upload(
        filePath,
        this.apiKey
      );

      console.log('File uploaded to Lighthouse:', response);
      return response.data.Hash;
    } catch (error) {
      console.error('Error uploading file to IPFS:', error);
      throw error;
    }
  }

  /**
   * Upload JSON data to IPFS
   * @param data JSON data to upload
   * @returns CID of the uploaded data
   */
  async uploadJSON(data: UploadFile): Promise<string> {
    try {
      // Create temporary file
      const tempFilePath = path.join(__dirname, `temp_${Date.now()}.json`);
      fs.writeFileSync(tempFilePath, JSON.stringify(data));

      // Upload file
      const cid = await this.uploadFile(tempFilePath);

      // Clean up temporary file
      fs.unlinkSync(tempFilePath);

      return cid;
    } catch (error) {
      console.error('Error uploading JSON to IPFS:', error);
      throw error;
    }
  }

  /**
   * Fetch data from IPFS by CID
   * @param cid The content identifier to fetch
   * @returns The content data
   */
  async fetchData(cid: string): Promise<any> {
    try {
      const url = `https://gateway.lighthouse.storage/ipfs/${cid}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }
      
      // Try to parse as JSON, otherwise return as text
      try {
        return await response.json();
      } catch {
        return await response.text();
      }
    } catch (error) {
      console.error('Error fetching data from IPFS:', error);
      throw error;
    }
  }

  /**
   * Get status of a file by CID
   * @param cid The content identifier to check
   * @returns Status information about the file
   */
  async getStatus(cid: string): Promise<any> {
    try {
      const status = await lighthouse.getUploads(this.apiKey);
      return status.data.fileList.find((upload: any) => upload.cid === cid);
    } catch (error) {
      console.error('Error getting file status:', error);
      throw error;
    }
  }
}