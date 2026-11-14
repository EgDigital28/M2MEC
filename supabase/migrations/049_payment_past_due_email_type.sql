-- Past due notices go through the payment reminder button (with "Past due"
-- ticked) but are logged as their own type, so Send history tells them apart.
alter type public.bet_email_type add value if not exists 'payment_past_due';
