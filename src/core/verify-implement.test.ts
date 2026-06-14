import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { verifyImplementation } from "./verify.js";
import { generateImplementPrompts } from "./implement.js";
import { loadCatalogFromRoot } from "./load-catalog.js";
import { loadAdapters } from "./adapters/load.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("verify edge cases", () => {
  it("handles file not found", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const verify = await verifyImplementation("/tmp/nonexistent-file.ts", "payments", result.value!);
    assert.equal(verify.valid, false);
    assert.ok(verify.issues.some((i) => i.kind === "file-not-found"));
  });

  it("handles unknown module", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const verify = await verifyImplementation("/tmp/any-file.ts", "nonexistent-module", result.value!);
    assert.equal(verify.valid, false);
    assert.equal(verify.issues[0]!.kind, "file-not-found");
  });

  it("detects missing functions", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const verify = await verifyImplementation("/tmp/any-file.ts", "billing", result.value!);
    assert.equal(verify.valid, false);
    assert.ok(verify.issues.length > 0, "should report all 10 missing functions");
    assert.equal(verify.contractFunctions.length, 10, "billing has 10 functions");
  });

  it("parses class methods correctly", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const goodImpl = `
export class StripeAdapter implements PaymentsContract {
  async initiatePayment(orderId: string, amount: number, currency: string, method: string): Promise<Payment> {
    // implementation
    return {} as Payment;
  }
  async verifyPayment(paymentId: string): Promise<Payment> {
    return {} as Payment;
  }
  async getPaymentByOrder(orderId: string): Promise<Payment | undefined> {
    return undefined;
  }
  async getWallet(userId: string): Promise<Wallet> { throw new Error('Not supported'); }
  async creditWallet(userId: string, amount: number, currency: string): Promise<WalletTransaction> { throw new Error('Not supported'); }
  async debitWallet(userId: string, amount: number, currency: string): Promise<WalletTransaction> { throw new Error('Not supported'); }
  async getWalletTransactions(userId: string, options?: Record<string, unknown>): Promise<PaginatedResult<WalletTransaction>> { throw new Error('Not supported'); }
  async initiateRefund(paymentId: string, amount: number, reason: string): Promise<Refund> {
    return {} as Refund;
  }
  async getRefundByOrder(orderId: string): Promise<Refund | undefined> {
    return undefined;
  }
  async getRefund(refundId: string): Promise<Refund> {
    return {} as Refund;
  }
}`;
    const fs = await import("node:fs/promises");
    await fs.writeFile("/tmp/test-stripe.ts", goodImpl);
    const verify = await verifyImplementation("/tmp/test-stripe.ts", "payments", result.value!);
    await fs.unlink("/tmp/test-stripe.ts");
    assert.ok(verify.valid, `expected valid, got ${verify.issues.length} issues: ${verify.issues.map((i) => i.message).join("; ")}`);
    assert.ok(verify.implFunctions.length >= 10, `expected >= 10 functions, got ${verify.implFunctions.length}`);
  });

  it("detects mismatched return types", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const badImpl = `
class Bad implements PaymentsContract {
  async initiatePayment(...args: any[]): Promise<any> { return {}; }
}`;
    const fs = await import("node:fs/promises");
    await fs.writeFile("/tmp/bad-stripe.ts", badImpl);
    const verify = await verifyImplementation("/tmp/bad-stripe.ts", "payments", result.value!);
    await fs.unlink("/tmp/bad-stripe.ts");
    assert.equal(verify.valid, false);
    assert.ok(verify.issues.filter((i) => i.kind === "missing").length > 8, "should report many missing functions");
  });

  it("ignores commented-out code", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const commentedImpl = `
class Commented implements PaymentsContract {
  // async initiatePayment(orderId: string): Promise<Payment> { return {}; }
  async verifyPayment(paymentId: string): Promise<Payment> { return {} as Payment; }
}`;
    const fs = await import("node:fs/promises");
    await fs.writeFile("/tmp/commented.ts", commentedImpl);
    const verify = await verifyImplementation("/tmp/commented.ts", "payments", result.value!);
    await fs.unlink("/tmp/commented.ts");
    assert.equal(verify.valid, false);
    assert.ok(verify.implFunctions.filter((f) => f === "initiatePayment").length === 0, "should not count commented-out function");
  });
});

describe("implement edge cases", () => {
  it("generates prompts for all implemented functions", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(join(ROOT, "adapters"));
    const prompts = generateImplementPrompts(result.value!, adapters, "payments", "stripe");
    assert.ok(prompts.length > 0, "should generate prompts");
    assert.equal(prompts.length, 6, "stripe implements 6 of 10 payments functions");
  });

  it("returns empty for unknown module", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(join(ROOT, "adapters"));
    const prompts = generateImplementPrompts(result.value!, adapters, "nonexistent", "stripe");
    assert.equal(prompts.length, 0);
  });

  it("returns empty for missing adapter", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(join(ROOT, "adapters"));
    const prompts = generateImplementPrompts(result.value!, adapters, "payments", "nonexistent");
    assert.equal(prompts.length, 0);
  });

  it("each prompt contains essential fields", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(join(ROOT, "adapters"));
    const prompts = generateImplementPrompts(result.value!, adapters, "payments", "stripe");
    for (const p of prompts) {
      assert.ok(p.function.length > 0);
      assert.ok(p.prompt.includes(p.function));
      assert.ok(p.prompt.includes("stripe"));
    }
  });
});

  it("detects aliased functions when reverse map is provided", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const moduleName = "payments";
    const tmpFile = "/tmp/blueprint-verify-test/aliased_payments.ts";
    const { writeFileSync, mkdirSync } = await import("node:fs");
    mkdirSync("/tmp/blueprint-verify-test", { recursive: true });
    writeFileSync(tmpFile, "async chargeCustomer(orderId: string, amount: number, currency: string, method: string): Promise<Payment> {\n  return {} as Payment;\n}");

    // Without aliases: initiatePayment should be missing
    const noAliases = await verifyImplementation(tmpFile, moduleName, result.value!);
    const initiatedMissing = noAliases.issues.find((i) => i.function === "initiatePayment");
    assert.ok(initiatedMissing, "initiatePayment should be missing without aliases");

    // With aliases: should find by aliased name
    const aliases = { functions: { initiatePayment: "chargeCustomer" } };
    const withAliases = await verifyImplementation(tmpFile, moduleName, result.value!, aliases);
    const stillMissing = withAliases.issues.find((i) => i.function === "initiatePayment");
    assert.ok(!stillMissing, "initiatePayment should not be missing when aliased to chargeCustomer");
  });

  it("detects obfuscated functions when seed is provided", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const moduleName = "payments";
    const { obfuscateName } = await import("../generators/aliases.js");
    const obfuscated = obfuscateName("test-seed", "initiatePayment");
    const tmpFile = "/tmp/blueprint-verify-test/obfuscated_payments.ts";
    const { writeFileSync, mkdirSync } = await import("node:fs");
    mkdirSync("/tmp/blueprint-verify-test", { recursive: true });
    writeFileSync(tmpFile, "async " + obfuscated + "(orderId: string, amount: number, currency: string, method: string): Promise<Payment> {\n  return {} as Payment;\n}");

    // Without seed: initiatePayment should be missing
    const noSeed = await verifyImplementation(tmpFile, moduleName, result.value!);
    const missingNoSeed = noSeed.issues.find((i) => i.function === "initiatePayment");
    assert.ok(missingNoSeed, "initiatePayment should be missing without seed");

    // With seed: should find by obfuscated name
    const withSeed = await verifyImplementation(tmpFile, moduleName, result.value!, undefined, "test-seed");
    const missingWithSeed = withSeed.issues.find((i) => i.function === "initiatePayment");
    assert.ok(!missingWithSeed, "initiatePayment should not be missing when obfuscated with correct seed");
  });
