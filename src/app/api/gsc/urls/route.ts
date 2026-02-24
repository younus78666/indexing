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

        let extractedUrls: string[] = [];
        let usedMethod = 'none';

        // ===== METHOD 1: Try fetching from registered sitemaps in GSC =====
        try {
            const sitemapsResponse = await webmasters.sitemaps.list({
                siteUrl: siteUrl,
            });

            const sitemaps = sitemapsResponse.data.sitemap || [];

            if (sitemaps.length > 0) {
                const parser = new xml2js.Parser();

                // Helper: fetch and parse a single sitemap XML with timeout
                const fetchSitemapUrls = async (url: string): Promise<string[]> => {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

                        const res = await fetch(url, { signal: controller.signal });
                        clearTimeout(timeoutId);

                        if (!res.ok) return [];
                        const txt = await res.text();
                        const result = await parser.parseStringPromise(txt);

                        if (result.urlset && result.urlset.url) {
                            return result.urlset.url.map((u: any) => u.loc[0]);
                        }
                        return [];
                    } catch (e) {
                        console.log(`Failed to fetch sitemap: ${url}`);
                        return [];
                    }
                };

                // Try ALL sitemaps (not just the first one), limited to 10 to avoid timeout
                const sitemapPaths = sitemaps
                    .map(s => s.path)
                    .filter(Boolean)
                    .slice(0, 10) as string[];

                for (const sitemapPath of sitemapPaths) {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 10000);

                        const xmlResponse = await fetch(sitemapPath, { signal: controller.signal });
                        clearTimeout(timeoutId);

                        if (!xmlResponse.ok) continue;

                        const xmlText = await xmlResponse.text();
                        const result = await parser.parseStringPromise(xmlText);

                        // Regular sitemap: <urlset><url><loc>...</loc></url></urlset>
                        if (result.urlset && result.urlset.url) {
                            const urls = result.urlset.url.map((u: any) => u.loc[0]);
                            extractedUrls.push(...urls);
                        }
                        // Sitemap index: <sitemapindex><sitemap><loc>...</loc></sitemap></sitemapindex>
                        else if (result.sitemapindex && result.sitemapindex.sitemap) {
                            const subSitemaps = result.sitemapindex.sitemap.map((s: any) => s.loc[0]);
                            // Limit sub-sitemaps to prevent Vercel timeout
                            const sitemapsToFetch = subSitemaps.slice(0, 5);
                            const urlsArrays = await Promise.all(sitemapsToFetch.map(fetchSitemapUrls));
                            extractedUrls.push(...urlsArrays.flat());
                        }
                    } catch (e) {
                        console.log(`Sitemap parse failed for ${sitemapPath}, trying next...`);
                        continue;
                    }
                }

                // Deduplicate
                extractedUrls = Array.from(new Set(extractedUrls));

                if (extractedUrls.length > 0) {
                    usedMethod = 'sitemap';
                }
            }
        } catch (e: any) {
            console.log('Sitemap method failed:', e.message);
        }

        // ===== METHOD 2: Fallback to Search Analytics API if sitemaps yielded nothing =====
        if (extractedUrls.length === 0) {
            try {
                const searchconsole = google.searchconsole({
                    version: 'v1',
                    auth: oAuth2Client,
                });

                const analyticsResponse = await searchconsole.searchanalytics.query({
                    siteUrl: siteUrl,
                    requestBody: {
                        startDate: getDateNDaysAgo(90), // Last 90 days
                        endDate: getDateNDaysAgo(1),
                        dimensions: ['page'],
                        rowLimit: 500,
                    },
                });

                const rows = analyticsResponse.data.rows || [];
                if (rows.length > 0) {
                    extractedUrls = rows.map((row: any) => row.keys[0]);
                    usedMethod = 'searchAnalytics';
                }
            } catch (e: any) {
                console.log('Search Analytics fallback also failed:', e.message);
            }
        }

        // ===== METHOD 3: Last resort - try common sitemap URL patterns directly =====
        if (extractedUrls.length === 0) {
            try {
                // Extract the base domain URL from the siteUrl
                let baseUrl = siteUrl;
                if (baseUrl.startsWith('sc-domain:')) {
                    baseUrl = `https://${baseUrl.replace('sc-domain:', '')}`;
                }
                // Remove trailing slash
                baseUrl = baseUrl.replace(/\/$/, '');

                const commonSitemapPaths = [
                    `${baseUrl}/sitemap.xml`,
                    `${baseUrl}/sitemap_index.xml`,
                    `${baseUrl}/post-sitemap.xml`,
                    `${baseUrl}/page-sitemap.xml`,
                ];

                const parser = new xml2js.Parser();

                for (const url of commonSitemapPaths) {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 6000);
                        const res = await fetch(url, { signal: controller.signal });
                        clearTimeout(timeoutId);

                        if (!res.ok) continue;
                        const txt = await res.text();
                        const result = await parser.parseStringPromise(txt);

                        if (result.urlset && result.urlset.url) {
                            extractedUrls = result.urlset.url.map((u: any) => u.loc[0]);
                            usedMethod = 'directSitemap';
                            break;
                        } else if (result.sitemapindex && result.sitemapindex.sitemap) {
                            // Found a sitemap index, fetch first few sub-sitemaps
                            const subUrls = result.sitemapindex.sitemap.map((s: any) => s.loc[0]).slice(0, 3);
                            for (const subUrl of subUrls) {
                                try {
                                    const subRes = await fetch(subUrl);
                                    if (!subRes.ok) continue;
                                    const subTxt = await subRes.text();
                                    const subResult = await parser.parseStringPromise(subTxt);
                                    if (subResult.urlset && subResult.urlset.url) {
                                        extractedUrls.push(...subResult.urlset.url.map((u: any) => u.loc[0]));
                                    }
                                } catch (e) { continue; }
                            }
                            if (extractedUrls.length > 0) {
                                usedMethod = 'directSitemap';
                                break;
                            }
                        }
                    } catch (e) {
                        continue;
                    }
                }

                extractedUrls = Array.from(new Set(extractedUrls));
            } catch (e: any) {
                console.log('Direct sitemap fallback failed:', e.message);
            }
        }

        return NextResponse.json({
            success: true,
            sitemap: usedMethod,
            urls: extractedUrls,
            message: extractedUrls.length === 0
                ? 'No URLs could be fetched. The site may not have a sitemap, or it may not have appeared in search results in the last 90 days.'
                : undefined,
        });

    } catch (error: any) {
        console.error('Sitemap Fetch Error:', error.message || error);
        return NextResponse.json({ error: error.message || 'Failed to fetch sitemap URLs' }, { status: 500 });
    }
}

function getDateNDaysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
}
