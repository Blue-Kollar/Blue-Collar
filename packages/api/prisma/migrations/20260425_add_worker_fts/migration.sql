-- Add tsvector column for full-text search on Worker
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Populate existing rows
UPDATE "Worker"
SET "searchVector" = to_tsvector('simple',
  coalesce(name, '') || ' ' || coalesce(bio, '')
);

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "worker_search_vector_idx"
  ON "Worker" USING GIN ("searchVector");

-- Trigger function: keep searchVector in sync on insert/update
CREATE OR REPLACE FUNCTION worker_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := to_tsvector('simple',
    coalesce(NEW.name, '') || ' ' || coalesce(NEW.bio, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS worker_search_vector_trigger ON "Worker";
CREATE TRIGGER worker_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, bio
  ON "Worker"
  FOR EACH ROW EXECUTE FUNCTION worker_search_vector_update();
