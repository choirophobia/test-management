CREATE TABLE "perf_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"name" text NOT NULL,
	"p95_ms" real,
	"p99_ms" real,
	"requests_per_second" real,
	"error_rate" real,
	"thresholds_passed" boolean,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "results" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"name" text NOT NULL,
	"full_name" text,
	"epic" text,
	"feature" text,
	"variant" text,
	"status" text NOT NULL,
	"known_bug" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"duration_ms" integer,
	"message" text,
	"trace" text,
	"case_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"suite" text NOT NULL,
	"platform" text NOT NULL,
	"format" text NOT NULL,
	"external_id" text,
	"github_run_url" text,
	"github_event" text,
	"branch" text,
	"commit_sha" text,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"passed" integer DEFAULT 0 NOT NULL,
	"flaky" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"broken" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_key" text NOT NULL,
	"title" text NOT NULL,
	"section" text,
	"platforms" text[] DEFAULT '{web}'::text[] NOT NULL,
	"type" text DEFAULT 'ui' NOT NULL,
	"priority" text,
	"preconditions" text,
	"steps" text,
	"expected" text,
	"automation" text DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "perf_metrics" ADD CONSTRAINT "perf_metrics_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "perf_metrics_run_idx" ON "perf_metrics" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "results_run_idx" ON "results" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "results_case_keys_idx" ON "results" USING gin ("case_keys");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_suite_external_idx" ON "runs" USING btree ("suite","external_id");--> statement-breakpoint
CREATE INDEX "runs_started_idx" ON "runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "test_cases_case_key_idx" ON "test_cases" USING btree ("case_key");--> statement-breakpoint
CREATE INDEX "test_cases_section_idx" ON "test_cases" USING btree ("section");