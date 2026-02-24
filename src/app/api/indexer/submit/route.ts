import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { urls, campaignName } = body;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ error: 'No URLs provided.' }, { status: 400 });
        }

        const apiKey = process.env.OMEGA_INDEXER_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Omega Indexer API key not configured.' }, { status: 500 });
        }

        const formattedUrls = urls.join('|');
        const cname = campaignName || `Campaign ${new Date().toISOString().split('T')[0]}`;

        // Create x-www-form-urlencoded body
        const params = new URLSearchParams();
        params.append('apikey', apiKey);
        params.append('campaignname', cname);
        params.append('urls', formattedUrls);

        const response = await fetch('https://www.omegaindexer.com/amember/dashboard/api', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });

        const textResponse = await response.text();

        // OmegaIndexer usually responds with a simple text string or JSON. We will return it to the client.
        return NextResponse.json({ success: true, message: textResponse });

    } catch (error: any) {
        console.error('Omega Indexer API Error:', error);
        return NextResponse.json({ error: 'Failed to communicate with Omega Indexer' }, { status: 500 });
    }
}
