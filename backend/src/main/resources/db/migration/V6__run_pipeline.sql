-- E1.6: how a run's film is rendered, recorded when the run is created (erkasa.render.pipeline). 'package' is
-- the default; 'legacy' is the rollback until the final E1.6 acceptance. Runs created before E1.6 stay null.
alter table run add column pipeline varchar(16);
alter table run add constraint run_pipeline_chk check (pipeline is null or pipeline in ('legacy', 'package'));
