import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { host, key, urls } = await request.json();

        if (!host || !key || !urls || !Array.isArray(urls)) {
            return NextResponse.json({ error: 'Missing required fields (host, key, urls array)' }, { status: 400 });
        }

        const indexNowEndpoint = 'https://api.indexnow.org/indexnow';

        const payload = {
            host,
            key,
            keyLocation: `https://${host}/${key}.txt`,
            urlList: urls,
        };

        const response = await fetch(indexNowEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`IndexNow API error: ${response.status} ${errorText}`);
        }

        return NextResponse.json({ success: true, message: 'Successfully submitted to IndexNow' });
    } catch (error: any) {
        console.error('IndexNow Error:', error.message || error);
        return NextResponse.json({ error: error.message || 'Failed to submit to IndexNow' }, { status: 500 });
    }
}
