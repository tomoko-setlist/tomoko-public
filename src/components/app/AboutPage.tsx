import { ContactFormPanel } from "./ContactPage";
import { DetailPanel } from "../detail/DetailUi";

export function AboutPage() {
    return (
        <div className="space-y-4">
            <DetailPanel className="p-4 md:p-6">
                <h1 className="flex items-center gap-2 text-lg font-bold text-red-700">
                    <span
                        className="h-5 w-5 bg-current"
                        aria-hidden="true"
                        style={{
                            WebkitMaskImage: "url('/icon.svg')",
                            WebkitMaskRepeat: "no-repeat",
                            WebkitMaskPosition: "center",
                            WebkitMaskSize: "contain",
                            maskImage: "url('/icon.svg')",
                            maskRepeat: "no-repeat",
                            maskPosition: "center",
                            maskSize: "contain",
                        }}
                    />
                    サポート
                </h1>
            </DetailPanel>

            <DetailPanel className="p-4 md:p-6">
                <h2 className="text-base font-bold text-slate-900">ToMoKoについて</h2>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                    ハロプロセトリ検索システム「ToMoKo」は、過去30年近いハロー！プロジェクトおよび関連アーティストのライブ・楽曲・メンバー情報を横断して検索できるデータベースです。
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                    サービス名の「ToMoKo」は「統一されたプラットフォーム」「網羅的なデータベース」「高度な検索機能」の頭文字を表し、いつ、どこで、だれが、何を歌ったかを瞬時に知ることができます。
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                    このサービスが音楽とライブに愛と情熱と誇りをもって歩んできたハロプロの歴史をより深く知る一助となれば幸いです。
                </p>
            </DetailPanel>

            <DetailPanel className="p-4 md:p-6">
                <h2 className="text-base font-bold text-slate-900">著作情報・免責事項</h2>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                    本サービスは一人のファンが個人で開発・運営している非公式サイトであり、ハロー！プロジェクトおよびアップフロントグループ等の関係各社とは一切関係ありません。
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                    サイト内に掲載される楽曲名、アーティスト名、作品名、各種商標・ロゴ等の権利は、それぞれの権利者に帰属します。
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                    セットリストや公演情報は事実情報として整理しており、編集・構成・表示には本サービス独自のデータ整備が含まれます。データの利用や転載は自由に行っていただいて構いません。
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                    データベースの内容は一部公式情報を参照しつつ、一般ファンによる公開情報ももとに構築しているため、誤り・欠落・更新遅延を含む場合があります。利用によって生じたいかなる損害についても責任を負いかねますので、必要に応じて公式情報も併せてご確認ください。
                </p>
                <p className="mt-2 text-xs leading-6 text-slate-600">
                    ※2023年後半以降のデータ収集にはAIエージェントを活用しているため、表記ゆれ等が残る可能性があります。継続的に修正・改善を進めています。
                </p>
            </DetailPanel>

            <DetailPanel className="p-4 md:p-6">
                <h2 className="text-base font-bold text-slate-900">利用状況データについて</h2>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                    ToMoKoでは、検索機能の改善とデータ整備の優先度判断のため、検索語・検索種別・検索結果件数などの利用状況データを匿名で集計する場合があります。
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                    送信前にメールアドレス、電話番号、URLなど個人情報に該当しうる文字列を除去し、IPアドレスやユーザーを識別するIDは保存しません。
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                    収集したデータは、検索機能の改善、データ品質の向上、機能開発や運営上の判断材料として利用します。
                </p>
            </DetailPanel>

            <DetailPanel className="p-4 md:p-6">
                <h2 className="text-base font-bold text-slate-900">お問い合わせ・誤り報告について</h2>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                    送信されたお問い合わせや誤り報告は、内容確認、データ修正、品質改善、運営上の判断材料として利用します。
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                    管理者の指示により、AIエージェントやCodexが内容の整理や修正方針の検討を支援する場合があります。
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                    対応完了後または対応不要と判断した内容は、削除または管理対象外として扱います。
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                    お名前とメールアドレスの入力は任意です。返信が必要な場合のみ入力してください。
                </p>
            </DetailPanel>

            <ContactFormPanel sourceContext="about-page" routeName="about" />
        </div>
    );
}
