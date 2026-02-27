import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';
import { checkUsageLimit, incrementUsage, logIndexingAttempt } from '@/lib/usage';
import { getUserWithSubscription } from '@/lib/usage';

export async function POST(request: Request) {
    try {
        const session: any = await auth();

        if (!session || !session.accessToken) {
            return NextResponse.json({ error: 'Unauthorized. Please sign in with Google.' }, { status: 401 });
        }

        // Get user from database
        const user = await getUserWithSubscription(session.user.email);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check usage limit
        const usageCheck = await checkUsageLimit(user.id, 'gsc', 1);
        if (!usageCheck.allowed) {
            return NextResponse.json({ 
                error: usageCheck.message || 'Usage limit exceeded',
                limit: usageCheck.limit,
                current: usageCheck.current,
                upgrade: true
            }, { status: 429 });
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

        // Increment usage and log
        await incrementUsage(user.id, 'gsc', 1);
        await logIndexingAttempt(user.id, url, 'GSC', 'success');

        return NextResponse.json({ 
            success: true, 
            data: response.data,
            usage: {
                used: usageCheck.current + 1,
                limit: usageCheck.limit
            }
        });
    } catch (error: any) {
        console.error('GSC Error:', error.message || error);
        
        // Log failed attempt
        try {
            const session: any = await auth();
            if (session?.user?.email) {
                const user = await getUserWithSubscription(session.user.email);
                if (user) {
                    await logIndexingAttempt(user.id, url, 'GSC', 'error', error.message);
                }
            }
        } catch (e) {
            // Ignore logging errors
        }
        
        return NextResponse.json({ error: error.message || 'Failed to submit to Google' }, { status: 500 });
    }
}
