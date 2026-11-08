-- A run = one video being made: topic -> script -> voice -> plan -> render.
-- Steps form a small DAG (depends_on). The orchestrator dispatches ready steps through the outbox
-- to RabbitMQ; workers report results and progress back. All retry/timeout state lives here.
create table run (
    id          varchar(64)  primary key,
    title       varchar(200),
    topic       text         not null,
    theme       varchar(32)  not null,
    voice       varchar(64)  not null,
    seconds     integer      not null,
    notes       text,
    -- silent = no ElevenLabs call (estimated timing, no narration); a cheap way to test the pipeline
    silent      boolean      not null default false,
    status      varchar(16)  not null default 'RUNNING',
    error       text,
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz  not null default now(),
    finished_at timestamptz,

    constraint run_status_chk check (status in ('RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
    constraint run_seconds_chk check (seconds between 20 and 120)
);

create index run_created_idx on run (created_at desc);

create table step (
    run_id       varchar(64)  not null references run (id) on delete cascade,
    id           varchar(32)  not null,
    position     integer      not null,
    task_type    varchar(32)  not null,
    status       varchar(16)  not null default 'PENDING',
    -- comma-separated ids of steps that must succeed first
    depends_on   varchar(200) not null default '',
    params       jsonb        not null default '{}'::jsonb,
    attempt      integer      not null default 0,
    max_attempts integer      not null default 3,
    timeout_s    integer      not null,
    not_before   timestamptz,
    deadline     timestamptz,
    progress     integer      not null default 0,
    message      text,
    outputs      jsonb        not null default '[]'::jsonb,
    metrics      jsonb        not null default '{}'::jsonb,
    error_code   varchar(64),
    error        text,
    queued_at    timestamptz,
    started_at   timestamptz,
    finished_at  timestamptz,

    primary key (run_id, id),
    constraint step_status_chk check (status in ('PENDING', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'))
);

create index step_ready_idx on step (status, not_before) where status = 'PENDING';
create index step_deadline_idx on step (deadline) where status in ('QUEUED', 'RUNNING');

-- Transactional outbox: a task command is committed together with the step change, then published.
create table outbox (
    id           bigserial    primary key,
    exchange     varchar(100) not null,
    routing_key  varchar(100) not null,
    payload      text         not null,
    created_at   timestamptz  not null default now(),
    published_at timestamptz
);

create index outbox_pending_idx on outbox (id) where published_at is null;
