
ALTER TABLE public.fb_config ADD COLUMN IF NOT EXISTS monitored_post_ids text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.sheets_config ADD COLUMN IF NOT EXISTS orders_sheet_url text;
ALTER TABLE public.sheets_config ADD COLUMN IF NOT EXISTS orders_sheet_id text;
ALTER TABLE public.sheets_config ADD COLUMN IF NOT EXISTS orders_sheet_tab text DEFAULT 'Orders';
ALTER TABLE public.sheets_config ADD COLUMN IF NOT EXISTS orders_last_synced_at timestamptz;

CREATE OR REPLACE FUNCTION public.log_order_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.analytics_events (event_type, meta)
  VALUES ('order_created', jsonb_build_object(
    'order_id', NEW.id,
    'customer_name', NEW.customer_name,
    'phone', NEW.phone,
    'total', NEW.total,
    'status', NEW.status,
    'conversation_id', NEW.conversation_id
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_log_analytics ON public.orders;
CREATE TRIGGER orders_log_analytics
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_analytics();
