// src/services/farcasterService.ts

import axios from 'axios';

export interface FarcasterCredentials {
  apiKey: string;
  signerUuid: string; // Signer UUID from Neynar
  fid: number;        // Farcaster ID
}

export interface CastOptions {
  text: string;
  embeds?: {
    url?: string;
    imageUrl?: string;
  }[];
  replyToFid?: number;    // Optional: FID to reply to
  replyToCastId?: string; // Optional: Cast hash to reply to
  channelId?: string;     // Optional: Channel to post in
}

export class FarcasterService {
  private apiKey: string;
  private signerUuid: string;
  private fid: number;
  private baseUrl = 'https://api.neynar.com/v2';

  constructor(credentials: FarcasterCredentials) {
    this.apiKey = credentials.apiKey;
    this.signerUuid = credentials.signerUuid;
    this.fid = credentials.fid;
  }

  /**
   * Post a cast to Farcaster
   * @param options CastOptions containing text and optional embeds/reply information
   * @returns The response from the API including the new cast hash
   */
  async postCast(options: CastOptions) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/farcaster/cast`,
        {
          signer_uuid: this.signerUuid,
          text: options.text,
          embeds: options.embeds || [],
          parent: options.replyToCastId ? {
            fid: options.replyToFid,
            hash: options.replyToCastId
          } : undefined,
          channel_id: options.channelId
        },
        {
          headers: {
            'accept': 'application/json',
            'api_key': this.apiKey,
            'content-type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error posting cast:', error);
      throw error;
    }
  }

  /**
   * Get user profile information
   * @param targetFid The Farcaster ID to lookup
   * @returns User profile information
   */
  async getUserProfile(targetFid: number) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/user?fid=${targetFid}`,
        {
          headers: {
            'accept': 'application/json',
            'api_key': this.apiKey
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  /**
   * Follow another user on Farcaster
   * @param targetFid The Farcaster ID to follow
   * @returns The response from the API
   */
  async followUser(targetFid: number) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/farcaster/follow`,
        {
          signer_uuid: this.signerUuid,
          target_fids: [targetFid]
        },
        {
          headers: {
            'accept': 'application/json',
            'api_key': this.apiKey,
            'content-type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error following user:', error);
      throw error;
    }
  }

  /**
   * Get user's FID by username
   * @param username The Farcaster username to lookup (without @)
   * @returns User information including FID
   */
  async getUserByUsername(username: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/farcaster/user-by-username?username=${username}`,
        {
          headers: {
            'accept': 'application/json',
            'api_key': this.apiKey
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching user by username:', error);
      throw error;
    }
  }


  /**
   * Fetch recent casts from a user by username
   * @param username The Farcaster username to fetch casts for (without @)
   * @param limit Number of casts to fetch (default: 25, max: 100)
   * @param cursor Optional cursor for pagination
   * @returns Object containing casts array and next cursor
   */
  async getRecentCastsByUsername(username: string, limit: number = 5, cursor?: string) {
    try {
      // First get the user's FID
      const userData = await this.getUserByUsername(username);
      const targetFid = userData.user.fid;

      // Then fetch their casts
      const response = await axios.get(
        `${this.baseUrl}/farcaster/casts`, {
          params: {
            fid: targetFid,
            limit: Math.min(limit, 100), // Ensure limit doesn't exceed API max
            cursor: cursor
          },
          headers: {
            'accept': 'application/json',
            'api_key': this.apiKey
          }
        }
      );

      return {
        casts: response.data.casts,
        nextCursor: response.data.next?.cursor
      };
    } catch (error) {
      console.error('Error fetching recent casts:', error);
      throw error;
    }
  }
}