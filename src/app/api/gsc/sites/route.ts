import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';

export async function GET() {
    try {
        const session: any = await auth();

        if (!session || !session.accessToken) {
            return NextResponse.json({ error: 'Unauthorized. Please sign in with Google.' }, { status: 401 });
        }

        const oAuth2Client = new google.auth.OAuth2();
        oAuth2Client.setCredentials({ access_token: session.accessToken as string });

        const webmasters = google.webmasters({
            version: 'v3',
            auth: oAuth2Client,
        });

        const response = await webmasters.sites.list();

        return NextResponse.json({ success: true, sites: response.data.siteEntry || [] });
    } catch (error: any) {
        console.error('GSC Sites Error:', error.message || error);
        return NextResponse.json({ error: error.message || 'Failed to fetch sites from Google' }, { status: 500 });
    }
}
