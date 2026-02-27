import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';
import { getUserWithSubscription } from '@/lib/usage';
import { PLANS } from '@/lib/stripe';

export async function GET() {
    try {
        const session: any = await auth();

        if (!session || !session.accessToken) {
            return NextResponse.json({ error: 'Unauthorized. Please sign in with Google.' }, { status: 401 });
        }

        // Get user subscription to check site limits
        const user = await getUserWithSubscription(session.user.email);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const plan = user.subscription?.plan || 'FREE';
        const planConfig = PLANS[plan as keyof typeof PLANS];
        const maxSites = planConfig.features.sites;

        const oAuth2Client = new google.auth.OAuth2();
        oAuth2Client.setCredentials({ access_token: session.accessToken as string });

        const webmasters = google.webmasters({
            version: 'v3',
            auth: oAuth2Client,
        });

        const response = await webmasters.sites.list();
        const allSites = response.data.siteEntry || [];
        
        // Limit sites based on plan
        const limitedSites = allSites.slice(0, maxSites);
        const hasMoreSites = allSites.length > maxSites;

        return NextResponse.json({ 
            success: true, 
            sites: limitedSites,
            totalSites: allSites.length,
            allowedSites: maxSites,
            hasMoreSites,
            plan,
            upgradeMessage: hasMoreSites 
                ? `Your ${plan} plan allows ${maxSites} site${maxSites > 1 ? 's' : ''}. Upgrade to access more sites.`
                : undefined
        });
    } catch (error: any) {
        console.error('GSC Sites Error:', error.message || error);
        return NextResponse.json({ error: error.message || 'Failed to fetch sites from Google' }, { status: 500 });
    }
}
