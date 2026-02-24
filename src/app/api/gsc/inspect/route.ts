import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';

export async function POST(request: Request) {
    try {
        const session: any = await auth();

        if (!session || !session.accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { url, siteUrl } = await request.json();

        if (!url || !siteUrl) {
            return NextResponse.json({ error: 'URL and siteUrl are required' }, { status: 400 });
        }

        const oAuth2Client = new google.auth.OAuth2();
        oAuth2Client.setCredentials({ access_token: session.accessToken as string });

        const searchconsole = google.searchconsole({
            version: 'v1',
            auth: oAuth2Client,
        });

        const response = await searchconsole.urlInspection.index.inspect({
            requestBody: {
                inspectionUrl: url,
                siteUrl: siteUrl,
                languageCode: 'en-US'
            }
        });

        const result = response.data.inspectionResult;

        // Determine status
        // VERDICT_UNSPECIFIED, PASS, PARTIAL, FAIL, NEUTRAL
        const isIndexed = result?.indexStatusResult?.verdict === 'PASS';
        const coverageState = result?.indexStatusResult?.coverageState || 'Unknown';

        return NextResponse.json({
            success: true,
            isIndexed,
            coverageState,
            rawVerdict: result?.indexStatusResult?.verdict
        });

    } catch (error: any) {
        console.error('URL Inspection Error:', error.message || error);
        return NextResponse.json({ error: error.message || 'Failed to inspect URL' }, { status: 500 });
    }
}
