-- Limgrow project seed extracted from the provided project screenshots.
-- Run after supabase/schema.sql. Safe to run repeatedly: existing names are skipped.
do $$
declare
  owner_id uuid;
begin
  select id into owner_id
  from public.profiles
  where role = 'project_manager'
  order by created_at
  limit 1;

  if owner_id is null then
    raise exception 'No Project Manager profile found. Run supabase/schema.sql first.';
  end if;

  insert into public.projects (name, client_name, color, status, created_by)
  select seed.name, null, seed.color, 'active', owner_id
  from (values
    ('li009-walk-mate', '#6957c8'),
    ('li011-fantastical-calendar', '#0c66e4'),
    ('la-002-flie-manager-file-browser', '#22a06b'),
    ('la-003-gemu', '#e2a319'),
    ('la-004-neon-keyboard', '#943d73'),
    ('la-011-dating-app', '#c9372c'),
    ('la-012-turbospeed', '#0055cc'),
    ('la-005-copy-my-data', '#5e4db2'),
    ('la-007-xbox', '#216e4e'),
    ('la-008-cardi-mate', '#b38600'),
    ('la-009-logo-maker', '#8f4f82'),
    ('la-010-authenticator', '#0c66e4'),
    ('la-013-rock-indentifier', '#22a06b'),
    ('la-014-the-roku-mobile-app', '#e2a319'),
    ('la-015-android-cat-identifier', '#6957c8'),
    ('la-016-banknote-identifier', '#0055cc'),
    ('la-018-led-light-controller-remote', '#216e4e'),
    ('la-019-chat-gpt', '#943d73'),
    ('la-022-new-ps-remote-gamu', '#c9372c'),
    ('la023-alexa-voice-assistants', '#5e4db2'),
    ('la024-country-ringtones', '#0c66e4'),
    ('la-026-ringtones-a200', '#22a06b'),
    ('la028-landmap-property-line-finder', '#e2a319'),
    ('la031-learn-programing', '#6957c8'),
    ('la032-nfc-scanner', '#0055cc'),
    ('la041-id-caller-spam-call-blocker', '#216e4e'),
    ('la043-mapxplorer-gps-navigation-app', '#943d73'),
    ('la044-ce5-contact', '#c9372c'),
    ('la-045-superbru-predictor-fantasy', '#5e4db2'),
    ('la046-people-finder-ai-deep-search', '#0c66e4'),
    ('la047-vpn-pro-internet-browser', '#22a06b'),
    ('la048-tracker-alert-device-scan', '#e2a319'),
    ('li024-la001-ai-translator', '#6957c8'),
    ('la034-li012-dec-ai', '#0055cc'),
    ('li021-la033-termux-app', '#216e4e'),
    ('la035-li013-fitness-app', '#943d73'),
    ('la036-li014-card-invitation', '#c9372c'),
    ('la037-li015-photo-editor-collage-maker', '#5e4db2'),
    ('la038-li016-uniscore', '#0c66e4'),
    ('la039-li017-live-earth-map', '#22a06b'),
    ('la040-li018-novel', '#e2a319'),
    ('la006-li019-pokemon-card-scanner', '#6957c8'),
    ('la042-li020-coloring-book-pixel', '#0055cc'),
    ('li22-la030-calorie-counter', '#216e4e'),
    ('la027-li005-dmv-permit-practice-test', '#943d73'),
    ('li010-la025-starview', '#c9372c'),
    ('li23-la029-ai-song-music-maker-musicf', '#5e4db2'),
    ('li-001-led-color-keyboard-snapkey', '#0c66e4'),
    ('li-002-tape-measure-app-ar-ruler-3d', '#22a06b'),
    ('li-003-speed-test', '#e2a319'),
    ('li-004-copy-my-data-v2', '#6957c8'),
    ('li006-smart-air-printer-app-scan', '#0055cc'),
    ('li007-ai-note', '#216e4e'),
    ('li008-watch-faces-iwatch-gallery', '#943d73')
  ) as seed(name, color)
  where not exists (
    select 1 from public.projects existing where lower(existing.name) = lower(seed.name)
  );
end $$;

select count(*) as imported_project_count
from public.projects
where name in (
  'li009-walk-mate',
  'li011-fantastical-calendar',
  'la-002-flie-manager-file-browser',
  'la-003-gemu',
  'la-004-neon-keyboard',
  'la-011-dating-app',
  'la-012-turbospeed',
  'la-005-copy-my-data',
  'la-007-xbox',
  'la-008-cardi-mate',
  'la-009-logo-maker',
  'la-010-authenticator',
  'la-013-rock-indentifier',
  'la-014-the-roku-mobile-app',
  'la-015-android-cat-identifier',
  'la-016-banknote-identifier',
  'la-018-led-light-controller-remote',
  'la-019-chat-gpt',
  'la-022-new-ps-remote-gamu',
  'la023-alexa-voice-assistants',
  'la024-country-ringtones',
  'la-026-ringtones-a200',
  'la028-landmap-property-line-finder',
  'la031-learn-programing',
  'la032-nfc-scanner',
  'la041-id-caller-spam-call-blocker',
  'la043-mapxplorer-gps-navigation-app',
  'la044-ce5-contact',
  'la-045-superbru-predictor-fantasy',
  'la046-people-finder-ai-deep-search',
  'la047-vpn-pro-internet-browser',
  'la048-tracker-alert-device-scan',
  'li024-la001-ai-translator',
  'la034-li012-dec-ai',
  'li021-la033-termux-app',
  'la035-li013-fitness-app',
  'la036-li014-card-invitation',
  'la037-li015-photo-editor-collage-maker',
  'la038-li016-uniscore',
  'la039-li017-live-earth-map',
  'la040-li018-novel',
  'la006-li019-pokemon-card-scanner',
  'la042-li020-coloring-book-pixel',
  'li22-la030-calorie-counter',
  'la027-li005-dmv-permit-practice-test',
  'li010-la025-starview',
  'li23-la029-ai-song-music-maker-musicf',
  'li-001-led-color-keyboard-snapkey',
  'li-002-tape-measure-app-ar-ruler-3d',
  'li-003-speed-test',
  'li-004-copy-my-data-v2',
  'li006-smart-air-printer-app-scan',
  'li007-ai-note',
  'li008-watch-faces-iwatch-gallery'
);
