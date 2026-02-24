import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';
import xml2js from 'xml2js';

export async function GET(request: Request) {
    try {
        const session: any = await auth();

        if (!session || !session.accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const siteUrl = searchParams.get('siteUrl');

        if (!siteUrl) {
            return NextResponse.json({ error: 'siteUrl parameter is required' }, { status: 400 });
        }

        const oAuth2Client = new google.auth.OAuth2();
        oAuth2Client.setCredentials({ access_token: session.accessToken as string });

        const webmasters = google.webmasters({
            version: 'v3',
            auth: oAuth2Client,
        });

        // 1. Fetch the list of sitemaps for this site from GSC
        const sitemapsResponse = await webmasters.sitemaps.list({
            siteUrl: siteUrl,
        });

        const sitemaps = sitemapsResponse.data.sitemap || [];

        if (sitemaps.length === 0) {
            // If no sitemaps found in GSC, we could try a default ping, but let's notify the user
            return NextResponse.json({
                success: true,
                urls: [],
                message: 'No sitemaps found for this property in Google Search Console'
            });
        }

        // 2. Fetch the XML content of the first sitemap (or all of them)
        // For simplicity, we'll fetch the first sitemap found.
        const targetSitemapPath = sitemaps[0].path;

        if (!targetSitemapPath) {
            return NextResponse.json({ error: 'Invalid sitemap path' }, { status: 500 });
        }

        const xmlResponse = await fetch(targetSitemapPath);
        if (!xmlResponse.ok) {
            return NextResponse.json({ error: `Failed to fetch sitemap XML from ${targetSitemapPath}` }, { status: 500 });
        }

        const xmlText = await xmlResponse.text();

        // 3. Parse the XML to extract URLs
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(xmlText);

        let extractedUrls: string[] = [];

        // Basic sitemap structure <urlset><url><loc>...</loc></url></urlset>
        if (result.urlset && result.urlset.url) {
            extractedUrls = result.urlset.url.map((u: any) => u.loc[0]);
        }
        // Sitemap index structure <sitemapindex><sitemap><loc>...</loc></sitemap></sitemapindex>
        else if (result.sitemapindex && result.sitemapindex.sitemap) {
            // If it's an index, we just return the sitemaps for now (handling nested is complex for a v1)
            // We'll just return the sub-sitemaps as URLs for the user to see, or we could fetch them recursively.
            extractedUrls = result.sitemapindex.sitemap.map((s: any) => s.loc[0]);
        }

        return NextResponse.json({
            success: true,
            sitemap: targetSitemapPath,
            urls: extractedUrls
        });

    } catch (error: any) {
        console.error('Sitemap Fetch Error:', error.message || error);
        return NextResponse.json({ error: error.message || 'Failed to fetch sitemap URLs' }, { status: 500 });
    }
}
