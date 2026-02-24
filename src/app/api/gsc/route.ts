import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';

export async function POST(request: Request) {
    try {
        const session: any = await auth();

        if (!session || !session.accessToken) {
            return NextResponse.json({ error: 'Unauthorized. Please sign in with Google.' }, { status: 401 });
        }

        const { url, type = 'URL_UPDATED' } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        const oAuth2Client = new google.auth.OAuth2();
        oAuth2Client.setCredentials({ access_token: session.accessToken as string });

        const indexing = google.indexing({
            version: 'v3',
            auth: oAuth2Client,
        });

        const response = await indexing.urlNotifications.publish({
            requestBody: {
                url,
                type, // 'URL_UPDATED' or 'URL_DELETED'
            },
        });

        return NextResponse.json({ success: true, data: response.data });
    } catch (error: any) {
        console.error('GSC Error:', error.message || error);
        return NextResponse.json({ error: error.message || 'Failed to submit to Google' }, { status: 500 });
    }
}
