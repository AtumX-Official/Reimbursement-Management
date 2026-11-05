import { useRef, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { FileText, Paperclip, Send, Trash2 } from "lucide-react";
import { submitClaim } from "@/claims";
import { prepareProof, uploadProof, type ProofFile } from "@/drive";
import { checkDate, formatDate, today } from "@/dates";
import { formatINR, toPaise } from "@/money";
import { field, Modal } from "@/ui";
import type { BankDetails } from "@/bank";
import { BankForm, BankSummary } from "@/BankForm";

const nameOf = (u: User) => u.displayName ?? u.email ?? "Unknown";

export default function ClaimForm({
  user,
  bank: savedBank,
  onDone,
}: {
  user: User;
  bank: BankDetails | null;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(today());
  const [amountText, setAmountText] = useState("");
  const [proof, setProof] = useState<ProofFile | null>(null);
  const [reading, setReading] = useState(false);
  const [step, setStep] = useState<"" | "uploading" | "saving">("");
  const [error, setError] = useState("");
  // The confirm step opens over the form, so everything typed above stays filled in.
  const [confirming, setConfirming] = useState(false);
  const [editBank, setEditBank] = useState(false);
  const [justSaved, setJustSaved] = useState<BankDetails | null>(null);
  const [sendError, setSendError] = useState("");
  const bank = justSaved ?? savedBank;
  const fileInput = useRef<HTMLInputElement>(null);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError("");
    try {
      setProof(await prepareProof(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const amount = toPaise(Number(amountText));

  // Step 1: check the form, then show the confirm step (which asks for bank details if missing).
  const review = (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return setError("Enter the reason for this expense.");
    const badDate = checkDate(date);
    if (badDate) return setError(badDate);
    if (!Number.isFinite(amount) || amount <= 0)
      return setError("Enter the amount you spent.");
    if (!proof) return setError("Attach the proof (bill photo or PDF).");
    setError("");
    setSendError("");
    setEditBank(!bank);
    setConfirming(true);
  };

  const closeConfirm = () => {
    if (step !== "") return;
    setConfirming(false);
    setEditBank(false);
  };

  // Step 2: upload the proof to Drive, then save the claim.
  const send = async () => {
    if (!proof || !bank) return;
    setSendError("");
    try {
      setStep("uploading");
      const uploaded = await uploadProof(user, proof, {
        reason: reason.trim(),
        date,
        amount,
      });
      setStep("saving");
      await submitClaim(
        { uid: user.uid, name: nameOf(user), email: user.email ?? "" },
        {
          title: reason.trim(),
          date,
          amount,
          proofId: uploaded.id,
          proofUrl: uploaded.url,
          proofName: uploaded.name,
        },
      );
      onDone();
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Could not submit the claim",
      );
      setStep("");
    }
  };

  const busy = step !== "" || reading;

  return (
    <>
      <form onSubmit={review} className="card mt-8 max-w-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            New reimbursement claim
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            One claim per bill. The admin will review it and pay you back.
          </p>
        </div>

        <label className="block text-xs text-ink-600">
          Reason
          <textarea
            autoFocus
            required
            rows={2}
            className={`${field} mt-1 resize-none`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Auto to client site – Guindy"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-ink-600">
            Date
            <input
              type="date"
              max={today()}
              required
              className={`${field} mt-1`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="text-xs text-ink-600">
            Amount (₹)
            <input
              required
              inputMode="decimal"
              type="number"
              min={0.01}
              step={0.01}
              className={`${field} mt-1 tabular-nums`}
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="0.00"
            />
          </label>
        </div>

        <div>
          <p className="text-xs text-ink-600">Proof</p>
          {proof ? (
            <div className="mt-1 flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50 p-2">
              {proof.type.startsWith("image/") ? (
                <img
                  src={proof.data}
                  alt="Proof preview"
                  className="h-14 w-14 rounded-lg object-cover"
                />
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-lg bg-white text-brand-600">
                  <FileText className="h-6 w-6" />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-ink-800">
                {proof.name}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => setProof(null)}
                className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-red-50 hover:text-red-600"
                aria-label="Remove proof"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={reading}
              onClick={() => fileInput.current?.click()}
              className="mt-1 flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-ink-200 px-4 py-6 text-sm text-ink-600 transition hover:border-brand-400 hover:bg-brand-50/50 disabled:opacity-60"
            >
              <Paperclip className="h-5 w-5 text-brand-600" />
              {reading ? "Preparing…" : "Attach a photo or PDF of the bill"}
              <span className="text-xs text-ink-400">
                Saved to the AtumX Google Drive folder · PDF up to 10 MB
              </span>
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onDone}
            disabled={step !== ""}
            className="btn-ghost"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="btn-primary disabled:opacity-60"
          >
            <Send className="h-4 w-4" /> Submit claim
          </button>
        </div>
      </form>

      {confirming && (
        <Modal
          title={
            editBank
              ? bank
                ? "Edit bank details"
                : "Add bank details to continue"
              : "Confirm your claim"
          }
          subtitle={
            editBank
              ? "Your claim stays filled in. You will come back to it after saving."
              : undefined
          }
          onClose={closeConfirm}
        >
          {editBank ? (
            <BankForm
              user={user}
              bank={bank}
              saveLabel="Save & continue"
              cancelLabel={bank ? "Back" : "Cancel"}
              onSaved={(b) => {
                setJustSaved(b);
                setEditBank(false);
              }}
              onCancel={() => (bank ? setEditBank(false) : closeConfirm())}
              note={
                !bank && (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Bank details are needed so the admin can pay you back.
                  </p>
                )
              }
            />
          ) : (
            bank && (
              <div className="space-y-3">
                <dl className="space-y-1 rounded-xl border border-ink-200 p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Reason</dt>
                    <dd className="text-right font-medium text-ink-900">
                      {reason.trim()}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Date</dt>
                    <dd className="font-medium text-ink-900">
                      {formatDate(date)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Amount</dt>
                    <dd className="font-semibold tabular-nums text-ink-900">
                      {formatINR(amount)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Proof</dt>
                    <dd className="min-w-0 truncate font-medium text-ink-900">
                      {proof?.name}
                    </dd>
                  </div>
                </dl>
                <BankSummary bank={bank} />
                <button
                  type="button"
                  disabled={step !== ""}
                  onClick={() => setEditBank(true)}
                  className="text-sm font-medium text-brand-700 hover:underline disabled:opacity-60"
                >
                  Change bank details
                </button>
                {sendError && (
                  <p className="text-sm text-red-600">{sendError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeConfirm}
                    disabled={step !== ""}
                    className="btn-ghost py-2"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={send}
                    disabled={step !== ""}
                    className="btn-primary py-2 disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {step === "uploading"
                      ? "Uploading proof…"
                      : step === "saving"
                        ? "Submitting…"
                        : "Confirm & submit"}
                  </button>
                </div>
              </div>
            )
          )}
        </Modal>
      )}
    </>
  );
}
