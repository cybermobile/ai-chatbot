CREATE TABLE IF NOT EXISTS "RagIngestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"source" varchar(255) NOT NULL,
	"documentsProcessed" jsonb DEFAULT '0'::jsonb,
	"embeddingsCreated" jsonb DEFAULT '0'::jsonb,
	"status" varchar(20),
	"error" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SecurityScans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"source" varchar(255) NOT NULL,
	"severity" varchar(20),
	"issuesFound" jsonb DEFAULT '0'::jsonb,
	"logsAnalyzed" jsonb DEFAULT '0'::jsonb,
	"analysis" jsonb,
	"emailSent" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"schedule" varchar(100),
	"config" jsonb NOT NULL,
	"enabled" boolean DEFAULT true,
	"lastRun" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "RagIngestions" ADD CONSTRAINT "RagIngestions_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SecurityScans" ADD CONSTRAINT "SecurityScans_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Workflows" ADD CONSTRAINT "Workflows_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
