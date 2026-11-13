-- Visual effects (fx_*: vignette, film grain, fire...) are a category of their own in the asset library.
alter table asset drop constraint asset_category_chk;
alter table asset add constraint asset_category_chk
    check (category in ('character', 'background', 'metaphor', 'object', 'icon', 'audio', 'effect'));
