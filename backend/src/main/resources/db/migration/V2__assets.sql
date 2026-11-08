-- Asset registry: an index over the asset library on disk (assets/manifest.json + each asset.json).
-- The files stay the source of truth; this table makes them searchable and rankable for the planner.
create table asset (
    asset_id     varchar(80)  primary key,
    version      integer      not null,
    name         varchar(200) not null,
    category     varchar(32)  not null,
    kind         varchar(32)  not null,
    adapter      varchar(32)  not null,
    style        varchar(64)  not null,
    -- directory relative to the asset root, e.g. characters/char_drini_01
    path         varchar(300) not null,
    themes       jsonb        not null default '[]'::jsonb,
    tags         jsonb        not null default '[]'::jsonb,
    capabilities jsonb        not null default '{}'::jsonb,
    license      jsonb        not null,
    -- the full, schema-validated asset.json
    meta         jsonb        not null,
    content_hash varchar(64)  not null,
    active       boolean      not null default true,
    indexed_at   timestamptz  not null default now(),

    constraint asset_category_chk check (category in ('character', 'background', 'metaphor', 'object', 'icon', 'audio'))
);

create index asset_category_idx on asset (category) where active;
create index asset_themes_idx on asset using gin (themes);
create index asset_tags_idx on asset using gin (tags);
