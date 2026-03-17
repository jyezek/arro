ALTER TABLE "prep_kits"
ADD COLUMN "whyInterested" TEXT,
ADD COLUMN "biggestStrength" TEXT,
ADD COLUMN "elevatorPitch" TEXT,
ADD COLUMN "preparationNotes" TEXT;

CREATE TABLE "company_research" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jobId" TEXT,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "company_research_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "company_research"
ADD CONSTRAINT "company_research_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_research"
ADD CONSTRAINT "company_research_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
