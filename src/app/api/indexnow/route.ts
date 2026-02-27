import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkUsageLimit, incrementUsage, logIndexingAttempt, getUserWithSubscription } from '@/lib/usage';

export async function POST(request: Request) {
    try {
        const session: any = await auth();

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user from database
        const user = await getUserWithSubscription(session.user.email);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const body = await request.json();
        const { host, key, urls } = body;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ error: 'No URLs provided' }, { status: 400 });
        }

        // Check usage limit
        const isBulk = urls.length > 1;
        const usageType = isBulk ? 'bulk_indexnow' : 'indexnow';
        const usageCheck = await checkUsageLimit(user.id, usageType, urls.length);
        
        if (!usageCheck.allowed) {
            return NextResponse.json({ 
                error: usageCheck.message || 'Usage limit exceeded',
                limit: usageCheck.limit,
                current: usageCheck.current,
                upgrade: true
            }, { status: 429 });
        }

        // Submit to IndexNow
        const endpoint = `https://api.indexnow.org/indexnow?url=${encodeURIComponent(host)}&key=${key}`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                host,
                key,
                urlList: urls,
            }),
        });

        // Increment usage
        await incrementUsage(user.id, 'indexnow', urls.length);
        
        // Log each URL
        for (const url of urls) {
            await logIndexingAttempt(user.id, url, isBulk ? 'BULK_INDEXNOW' : 'INDEXNOW', 'success');
        }

        return NextResponse.json({ 
            success: true, 
            message: `Successfully submitted ${urls.length} URLs to IndexNow`,
            usage: {
                used: usageCheck.current + urls.length,
                limit: usageCheck.limit
            }
        });
    } catch (error: any) {
        console.error('IndexNow Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to submit to IndexNow' }, { status: 500 });
    }
}
