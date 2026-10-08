import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { generatePlanFunction } from "@/lib/inngest/functions/generatePlan";
import { analyzeActivityFunction } from "@/lib/inngest/functions/analyzeActivity";
import { syncAllUsersFunction } from "@/lib/inngest/functions/syncAllUsers";
import { syncUserFunction } from '@/lib/inngest/functions/syncUser';
import {
  finalizeAwardsWeeklyFunction,
  finalizeAwardsMonthlyFunction,
} from "@/lib/inngest/functions/finalizeAwardsCron";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generatePlanFunction,
    analyzeActivityFunction,
    syncAllUsersFunction,
    syncUserFunction,
    finalizeAwardsWeeklyFunction,
    finalizeAwardsMonthlyFunction,
  ],
});
