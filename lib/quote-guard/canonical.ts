import txlineFixture from "@/fixtures/txline/v4-france-morocco-lifecycle.json";
import lifecycleFixture from "@/fixtures/lineguard/v4-france-morocco-lifecycle.json";
import { createQuoteGuardCommitment, verifyQuoteGuard, type TxlineOddsForQuoteGuard } from "@/lib/quote-guard";
import { V4_CANONICAL } from "@/lib/v4/lifecycleEvidence";

const preOdds = txlineFixture.preGoalOddsValidation.odds as TxlineOddsForQuoteGuard;
const postOdds = txlineFixture.postGoalOddsValidation.odds as TxlineOddsForQuoteGuard;

export const CANONICAL_PRE_GOAL_QUOTE = createQuoteGuardCommitment({
  odds: preOdds,
  quoteSequence: V4_CANONICAL.preGoal.quoteSequence,
  materialEventSequence: V4_CANONICAL.preGoal.materialEventSequence,
  spreadMicros: V4_CANONICAL.spreadMicros,
});

export const CANONICAL_POST_GOAL_QUOTE = createQuoteGuardCommitment({
  odds: postOdds,
  quoteSequence: V4_CANONICAL.postGoal.quoteSequence,
  materialEventSequence: V4_CANONICAL.postGoal.materialEventSequence,
  spreadMicros: V4_CANONICAL.spreadMicros,
});

export const CANONICAL_QUOTE_GUARD = {
  pre: {
    odds: preOdds,
    commitment: CANONICAL_PRE_GOAL_QUOTE,
    verification: verifyQuoteGuard(CANONICAL_PRE_GOAL_QUOTE, preOdds, lifecycleFixture.txline.preQuotePayloadHashHex),
    receipt: lifecycleFixture.accounts.quoteReceiptPre,
  },
  post: {
    odds: postOdds,
    commitment: CANONICAL_POST_GOAL_QUOTE,
    verification: verifyQuoteGuard(CANONICAL_POST_GOAL_QUOTE, postOdds, lifecycleFixture.txline.postQuotePayloadHashHex),
    receipt: lifecycleFixture.accounts.quoteReceiptPost,
  },
} as const;
