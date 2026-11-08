-- Projects: one video idea each. No user/tenant columns: V1 is a single-user studio (no SaaS).
create table project (
    id                uuid primary key default gen_random_uuid(),
    title             varchar(200) not null,
    topic             text         not null,
    language          varchar(8)   not null default 'en',
    format            varchar(8)   not null default '9:16',
    target_duration_s integer      not null default 60,
    style_id          varchar(64)  not null default 'erkasa_flat_v1',
    voice_id          varchar(128),
    created_at        timestamptz  not null default now(),
    updated_at        timestamptz  not null default now(),

    constraint project_language_chk check (language in ('en')),
    constraint project_format_chk check (format in ('9:16', '16:9', '1:1')),
    constraint project_duration_chk check (target_duration_s between 15 and 180)
);

create index project_created_at_idx on project (created_at desc);
