import { ApiRequest, ApiResponse } from '../http';
import { getLinkPreview } from 'link-preview-js';

export async function POST(request: ApiRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return ApiResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    const previewData = await getLinkPreview(url, {
      timeout: 2000,
      headers: {
        'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
      },
    });
    
    return ApiResponse.json(previewData);
  } catch (error) {
    console.error('Error fetching link preview:', error);
    return ApiResponse.json({ error: 'Failed to fetch link preview' }, { status: 500 });
  }
}