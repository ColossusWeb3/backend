import { IPFSService } from './services/storage/ipfsService';
import { UploadFile } from './types';

async function test() {
  try {
    const ipfsService = new IPFSService();
    
    // Test uploading JSON data
    const testData: UploadFile = {
      name: "Test Document",
      content: "This is a test document for IPFS storage",
      timestamp: new Date()     
    };
    
    console.log("Uploading test data to IPFS...");
    const cid = await ipfsService.uploadJSON(testData);
    console.log(`Data uploaded successfully. CID: ${cid}`);
    
    // Test fetching data
    console.log("Fetching data from IPFS...");
    const fetchedData = await ipfsService.fetchData(cid);
    console.log("Fetched data:", fetchedData);
    
    // Test getting status
    console.log("Getting file status...");
    const status = await ipfsService.getStatus(cid);
    console.log("File status:", status);
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
test();