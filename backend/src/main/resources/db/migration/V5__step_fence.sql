-- E1.6: fencing token for attempt isolation. Every dispatch draws a new number from the sequence and stores
-- it on the step; a result can publish its files only while its fence is the step's current one. Unlike
-- `attempt`, the fence is never reset (a run retry restarts attempt at 1), so it is never reused.
create sequence step_fence_seq;

alter table step add column fence bigint;
