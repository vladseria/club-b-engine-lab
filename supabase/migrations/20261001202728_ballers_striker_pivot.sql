-- Ballers: a fourth Striker option, "Pivot" (stored 'pivot'), and a new Short
-- preset (style-identity round, ENGINE-TRUTHFULNESS-PLAN, approved
-- 2026-09-30). The Striker row reads Mixed / Drops deep / Pivot / Runs in
-- behind; "Drops deep" is the old "Links play" renamed in the UI only (same
-- stored 'link', same behaviour). The engine reads 'pivot' from the style-pivot
-- engine build on (packages/football-engine team-approach validateApproach).
--
-- Additive and safe to apply before or after the client that writes it:
-- no table, column, constraint, grant or row changes; two functions are
-- replaced. Sorts after (and keeps everything from) the still-unapplied
-- 20260929222155_ballers_on_losing_it, whose "onLoss" support is restated
-- here unchanged.
--
-- * private.ballers_valid_approach(p): identical to 20260929222155 except that
--   "striker" also accepts 'pivot'. Every value the old body accepted is still
--   accepted, so the CHECK constraints on ballers_clubs.approach,
--   ballers_prep.approach and ballers_styles.settings keep holding for every
--   existing row (nothing is re-validated or rewritten). Applied before the
--   client, the only difference is that 'pivot' becomes storable early; a
--   client that offers 'pivot' before this is applied gets 'invalid_approach'
--   on save. Mirrors lib/ballers/league.ts APPROACH_FIELDS and the engine's
--   validateApproach (verificare/ballers-approach.test.ts).
-- * private.ballers_preset(style): "combinations" (Short) becomes width
--   'standard' (was 'narrow') and striker 'pivot' (was 'link'); every other key
--   (patient / high / balanced / 3 / secure / counterpress) and the other three
--   presets are unchanged (mirrors lib/ballers/league.ts PRESETS and the
--   engine's teamApproaches.combinations).
--
-- Who changes behaviour: nobody already playing. A preset is COPIED into
-- storage, never read at match time: ballers_create_club stores
-- ballers_preset(style) in ballers_clubs.approach at founding, ballers_update_club
-- stores it only when a style change arrives without an approach (the client
-- always sends one), and ballers_save_prep (private.ballers_write_prep) falls
-- back to it only when an old client sends no approach. Preps are built from the stored club/last-prep
-- approach and private.ballers_input_side freezes prep.approach as is. AI clubs
-- never use the preset at all: ballers_seed_ai / the calibration migrations
-- write each AI club's own authored approach from ballers_squad_data()->'ai'
-- (Umanoizii and Rapid Pensia are style 'combinations' but carry their own
-- approach with striker 'link'; untouched). So a member club that stored the
-- old Short preset keeps playing narrow + 'link' (now labelled "Drops deep")
-- until its manager picks Short again; the client then shows its fine-tune as
-- "Adjusted", because it no longer equals the Short preset.
--
-- public.ballers_save_style is NOT replaced: its no-preset fallback (only an
-- old client that sends no p_preset reaches it; the current client always
-- sends one) calls private.ballers_preset, so it now matches the new Short
-- preset; an old-Short seven/eight-key style saved by such a client would be
-- labelled 'balanced'. That label is cosmetic (ballers_styles.preset) and the
-- settings are stored as sent. The one-time backfill in
-- 20260925070407_ballers_fix_round_ideas_styles already ran and is not re-run.
-- Only ballers_* objects change.

create or replace function private.ballers_valid_approach(p jsonb)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select coalesce(
    jsonb_typeof(p) = 'object'
    and (select count(*) from jsonb_object_keys(p)) = case when p ? 'onLoss' then 8 else 7 end
    and p->>'progression' in ('patient', 'mixed', 'direct')
    and p->>'width' in ('narrow', 'standard', 'wide')
    and p->>'line' in ('deep', 'standard', 'high')
    and p->>'press' in ('selective', 'balanced', 'aggressive')
    and p->>'striker' in ('mixed', 'link', 'pivot', 'run')
    and p->>'transition' in ('balanced', 'secure', 'counter')
    and (not p ? 'onLoss' or (jsonb_typeof(p->'onLoss') = 'string'
                              and p->>'onLoss' in ('regroup', 'balanced', 'counterpress')))
    and case when jsonb_typeof(p->'commit') = 'number'
             then (p->>'commit')::numeric in (1, 2, 3, 4, 5) else false end,
    false)
$$;

-- Mirrors packages/football-engine/src/team-approach.ts `teamApproaches`,
-- plus "onLoss" (lib/ballers/league.ts PRESETS).
-- "onLoss" by football identity: combinations counter-press (B3); balanced,
-- direct and counter stay balanced (R1, 2026-10-01).
-- combinations: width standard + striker pivot (style-identity round).
create or replace function private.ballers_preset(p_style text)
returns jsonb
language sql
immutable
set search_path to ''
as $$
  select case p_style
    when 'balanced' then '{"progression":"mixed","width":"standard","line":"standard","press":"balanced","commit":3,"striker":"mixed","transition":"balanced","onLoss":"balanced"}'::jsonb
    when 'combinations' then '{"progression":"patient","width":"standard","line":"high","press":"balanced","commit":3,"striker":"pivot","transition":"secure","onLoss":"counterpress"}'::jsonb
    when 'direct' then '{"progression":"direct","width":"wide","line":"standard","press":"balanced","commit":4,"striker":"run","transition":"balanced","onLoss":"balanced"}'::jsonb
    when 'counter' then '{"progression":"mixed","width":"standard","line":"deep","press":"selective","commit":3,"striker":"mixed","transition":"counter","onLoss":"balanced"}'::jsonb
  end
$$;

-- create or replace keeps owners and grants; restated as the originals set them.
revoke all on function private.ballers_valid_approach(jsonb) from public;
revoke all on function private.ballers_preset(text) from public;
