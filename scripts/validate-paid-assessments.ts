import paidBusiness from "../config/assessments/paid-business.json";
import paidHealthcare from "../config/assessments/paid-healthcare.json";
import { assessmentConfigSchema } from "../src/lib/assessments/schema";

function validate(name: string, config: unknown) {
  const parsed = assessmentConfigSchema.parse(config);
  const domainIds = new Set(parsed.domains.map((d) => d.id));
  for (const q of parsed.questions) {
    if (!domainIds.has(q.domainId)) {
      throw new Error(`${name}: question ${q.id} references unknown domainId "${q.domainId}"`);
    }
  }
  const counts = Object.fromEntries(
    parsed.domains.map((d) => [
      d.name,
      parsed.questions.filter((q) => q.domainId === d.id).length,
    ]),
  );
  console.log(`${name}: ${parsed.questions.length} questions`, counts);
}

validate("paid-healthcare", paidHealthcare);
validate("paid-business", paidBusiness);
console.log("Paid assessment configs OK");
