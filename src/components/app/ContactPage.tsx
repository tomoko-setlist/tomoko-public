import { useState } from "react";

import { submitIssueReport } from "../../lib/reportIssue";
import { DetailPanel } from "../detail/DetailUi";
import { ExternalLinkIcon, GithubIcon } from "../ui";

type ContactReportType = "correction" | "missing_info" | "request" | "other";

const REPORT_TYPE_OPTIONS: Array<{ value: ContactReportType; label: string }> = [
    { value: "correction", label: "誤り" },
    { value: "missing_info", label: "不足情報" },
    { value: "request", label: "要望" },
    { value: "other", label: "その他" },
];

const GITHUB_URL = "https://github.com/tomoko-setlist/tomoko-public";

export function ContactPage() {
    return (
        <div className="space-y-4">
            <DetailPanel className="p-4 md:p-6">
                <h1 className="text-lg font-bold text-red-700">サポート</h1>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                    掲載情報や機能について、修正依頼、改善要望、ご意見等ございましたら、下記のフォームまたは
                    <a
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noreferrer"
                        title="tomoko-setlist/tomoko-public"
                        className="mx-1 inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                    >
                        <GithubIcon className="h-3.5 w-3.5" />
                        GitHub
                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                    </a>
                    よりお送りください。
                </p>
            </DetailPanel>

            <ContactFormPanel sourceContext="contact-page" routeName="contact" />
        </div>
    );
}

export function ContactFormPanel({
    sourceContext,
    routeName,
}: {
    sourceContext: "about-page" | "contact-page";
    routeName: "about" | "contact";
}) {
    const [reportType, setReportType] = useState<ContactReportType>("correction");
    const [message, setMessage] = useState("");
    const [contactName, setContactName] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [sent, setSent] = useState(false);

    const handleSubmit = async () => {
        if (typeof window === "undefined") return;
        const trimmedMessage = message.trim();
        const trimmedName = contactName.trim();
        const trimmedEmail = contactEmail.trim();
        setSent(false);
        if (trimmedMessage.length < 3) {
            setError("内容を3文字以上入力してください。");
            return;
        }
        if (trimmedMessage.length > 1000) {
            setError("内容は1000文字以内で入力してください。");
            return;
        }
        if (trimmedName.length > 80) {
            setError("お名前は80文字以内で入力してください。");
            return;
        }
        if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            setError("メールアドレスの形式を確認してください。");
            return;
        }

        setSending(true);
        setError("");
        try {
            await submitIssueReport({
                message: trimmedMessage,
                pageUrl: window.location.href,
                pageTitle: document.title || "お問い合わせ",
                routeName,
                routeId: null,
                reportType,
                contactName: trimmedName,
                contactEmail: trimmedEmail,
                sourceContext,
            });
            setMessage("");
            setContactName("");
            setContactEmail("");
            setReportType("correction");
            setSent(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSending(false);
        }
    };

    return (
        <DetailPanel className="p-4 md:p-6">
                <h2 className="text-base font-bold text-slate-900">お問い合わせ</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                    データの誤り、不足情報、機能要望、その他の連絡を送信できます。
                </p>
                <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                    <label className="text-sm font-semibold text-slate-800">
                        種別
                        <select
                            value={reportType}
                            onChange={(event) =>
                                setReportType(event.target.value as ContactReportType)
                            }
                            className="mt-1 w-full rounded-none border-2 border-gray-800 bg-white px-2 py-2 text-sm"
                        >
                            {REPORT_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <label className="mt-3 block text-sm font-semibold text-slate-800">
                    内容
                    <textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        rows={8}
                        maxLength={1000}
                        placeholder="気づいた点や修正してほしい内容を入力してください。該当ページのURLや、正しい情報が分かる場合はあわせて記載してください。"
                        className="mt-1 w-full rounded-none border-2 border-gray-800 px-2 py-2 text-sm"
                    />
                </label>

                <label className="mt-3 block text-sm font-semibold text-slate-800">
                    お名前（任意）
                    <input
                        type="text"
                        value={contactName}
                        onChange={(event) => setContactName(event.target.value)}
                        maxLength={80}
                        placeholder="例: 山田 太郎"
                        className="mt-1 w-full rounded-none border-2 border-gray-800 px-2 py-2 text-sm"
                    />
                </label>

                <label className="mt-3 block text-sm font-semibold text-slate-800">
                    メールアドレス（返信が必要な場合のみ）
                    <input
                        type="email"
                        value={contactEmail}
                        onChange={(event) => setContactEmail(event.target.value)}
                        maxLength={254}
                        placeholder="you@example.com"
                        className="mt-1 w-full rounded-none border-2 border-gray-800 px-2 py-2 text-sm"
                    />
                </label>

                <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">{message.length}/1000</span>
                    <button
                        type="button"
                        onClick={() => {
                            void handleSubmit();
                        }}
                        disabled={sending}
                        className="rounded-none border-2 border-gray-800 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {sending ? "送信中..." : "送信"}
                    </button>
                </div>

                <p className="mt-3 px-1 py-1 text-xs leading-5 text-slate-700">
                    ※いただいた内容は、確認・修正対応・サービス改善のために利用します。本文には住所、電話番号、パスワードなどを書かないでください。
                </p>

                {error ? (
                    <p className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </p>
                ) : null}
                {sent ? (
                    <p className="mt-3 border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
                        送信しました。ありがとうございます。
                    </p>
                ) : null}
            </DetailPanel>
    );
}
