// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { bookingId, newStatus } = await req.json()

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select(`*, profiles:client_id (full_name, email)`)
            .eq('id', bookingId)
            .single()

        if (bookingError || !booking) {
            throw new Error('Booking not found')
        }

        const clientEmail = booking.profiles?.email
        const clientName = booking.profiles?.full_name || 'Valued Customer'

        if (!clientEmail) {
            throw new Error('Client email not found')
        }

        let subject = ''
        let heading = ''
        let message = ''
        let statusColor = '#2563eb'

        switch (newStatus) {
            case 'confirmed':
                subject = '✅ Booking Confirmed - Very Handy'
                heading = 'Your Booking is Confirmed!'
                message = `Great news! Your booking for <strong>${booking.service_type}</strong> has been confirmed by our team.`
                statusColor = '#16a34a'
                break
            case 'rejected':
                subject = '❌ Booking Update - Very Handy'
                heading = 'Booking Status Update'
                message = `We're sorry, but we are unable to confirm your booking for <strong>${booking.service_type}</strong> at this time.`
                statusColor = '#dc2626'
                break
            case 'completed':
                subject = '🎉 Service Completed - Very Handy'
                heading = 'Thank You!'
                message = `Your service (<strong>${booking.service_type}</strong>) has been marked as completed. We hope you're satisfied with our work!`
                statusColor = '#7c3aed'
                break
            default:
                subject = '📋 Booking Update - Very Handy'
                heading = 'Booking Status Changed'
                message = `Your booking status has been updated to: <strong>${newStatus}</strong>`
        }

        const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 0; margin: 0; color: #334155;"><div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;"><div style="background-color: ${statusColor}; padding: 30px; text-align: center;"><div style="color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase;">Very Handy</div><div style="color: rgba(255,255,255,0.8); font-size: 10px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; margin-top: 5px;">Home Service Inc.</div></div><div style="padding: 40px 30px;"><h2 style="color: #1e293b; font-size: 20px; font-weight: 800; margin: 0 0 10px 0; text-transform: uppercase;">${heading}</h2><p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">Hi ${clientName},</p><p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 30px 0;">${message}</p><div style="background-color: #f1f5f9; border-left: 4px solid ${statusColor}; border-radius: 8px; padding: 20px; margin-bottom: 30px;"><div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 10px;">Booking Details</div><div style="font-size: 14px; color: #334155; margin-bottom: 8px;"><strong>Service:</strong> ${booking.service_type}</div><div style="font-size: 14px; color: #334155; margin-bottom: 8px;"><strong>Branch:</strong> ${booking.branch_name || 'Main Office'}</div><div style="font-size: 14px; color: #334155; margin-bottom: 8px;"><strong>Address:</strong> ${booking.address}</div><div style="font-size: 14px; color: #334155; margin-bottom: 8px;"><strong>Date:</strong> ${new Date(booking.booking_date).toLocaleString()}</div><div style="font-size: 14px; color: #334155;"><strong>Status:</strong> <span style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase; font-weight: bold;">${newStatus}</span></div></div>${newStatus === 'completed' ? '<div style="text-align: center; padding: 20px; background-color: #eff6ff; border-radius: 8px;"><p style="color: #1e40af; font-size: 14px; margin: 0 0 10px 0; font-weight: bold;">How was your experience?</p><p style="color: #64748b; font-size: 13px; margin: 0;">We\'d love to hear your feedback! Please leave a review in your dashboard.</p></div>' : ''}</div><div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;"><p style="color: #94a3b8; font-size: 12px; margin: 0 0 10px 0;">Need help? Contact us anytime.</p><p style="color: #cbd5e1; font-size: 12px; margin: 0;">&copy; 2026 Very Handy Home Service Inc.</p></div></div></body></html>`

        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

        if (!RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY not configured')
        }

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: 'Very Handy <onboarding@resend.dev>',
                to: [clientEmail],
                subject: subject,
                html: emailHtml
            })
        })

        const resendData = await res.json()

        if (!res.ok) {
            console.error('Resend API error:', resendData)
            throw new Error(`Email send failed: ${resendData.message || 'Unknown error'}`)
        }

        console.log(`✅ Email sent to ${clientEmail}:`, subject)

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Email sent successfully',
                clientEmail,
                status: newStatus,
                emailId: resendData.id
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error) {
        console.error('Function error:', error)
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error',
                success: false
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            }
        )
    }
})