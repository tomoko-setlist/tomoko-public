/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";

export type ArticleStatus = "published" | "draft";

export type Article = {
    slug: string;
    title: string;
    summary: string;
    publishedAt: string;
    status: ArticleStatus;
    tags: string[];
    heroLabel: string;
    content: ReactNode;
};

const ARTICLE_TAG_CLASS =
    "border border-neutral-400 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-700";

const ArticleBody = ({ children }: { children: ReactNode }) => (
    <div className="mx-auto max-w-3xl space-y-6 text-[15px] leading-8 text-slate-800">
        {children}
    </div>
);

const ArticleLead = ({ children }: { children: ReactNode }) => (
    <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-base font-semibold leading-8 text-slate-900">
        {children}
    </p>
);

const ArticleEmphasis = ({ children }: { children: ReactNode }) => (
    <p className="border-l-4 border-slate-900 bg-white px-4 py-3 text-base font-bold leading-8 text-slate-950 shadow-sm">
        {children}
    </p>
);

const ArticleAside = ({ children }: { children: ReactNode }) => (
    <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold leading-7 text-slate-700">
        {children}
    </p>
);

const ArticleSignature = ({ children }: { children: ReactNode }) => (
    <p className="text-right text-sm font-black tracking-[0.18em] text-red-700">
        {children}
    </p>
);

const ArticleSection = ({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) => (
    <section className="space-y-3">
        <h2 className="border-b-2 border-gray-800 pb-2 text-xl font-bold text-slate-950">
            {title}
        </h2>
        <div className="space-y-3">{children}</div>
    </section>
);

export const ARTICLES: Article[] = [
    {
        slug: "2026-07-02-4th-anniversary",
        title: "サービス公開4周年のご挨拶",
        summary: "ToMoKo公開4周年の感謝とお願い",
        publishedAt: "2026-07-02T00:00:00+09:00",
        status: "published",
        tags: ["運営", "周年", "ToMoKo"],
        heroLabel: "4TH ANNIVERSARY",
        content: (
            <ArticleBody>
                <ArticleLead>
                    いつもハロプロセトリ検索システムをご利用いただき、ありがとうございます！！
                </ArticleLead>

                <p>
                    本日、2026年7月2日で、ToMoKoはサービス公開から4年を迎えました。
                </p>

                <p>
                    ……と、胸を張って言いたいところですが、途中で1年以上更新が止まり、利用できない期間もありました。ご不便をおかけした皆様には、改めてお詫び申し上げます。
                </p>

                <p>
                    これはひとえに私の継続力、技術力、体力、吸収力、粘り、要領の良さなどが不足していたためです。
                </p>

                <p>
                    それでも、こうしてまたサービスを作り直し、データベースの更新を再開できていることを、とても嬉しく思っています。
                </p>

                <ArticleSection title="変化">
                    <p>
                        さて、この4年間でToMoKoだけでなく、ハロプロも、世間にも様々な変化がありました。
                    </p>
                    <p>
                        まず個人的なことからいきますと、4年前はWEB開発ド素人だったのですが、このサービスを作ったことがきっかけでSEでもやってみようかと思い、現在は一応Webサービスを作るお仕事をしています。
                    </p>
                    <p>ものすごく単純化、いや美化していえば、</p>
                    <ArticleEmphasis>
                        「ハロヲタをやっていたら、システムを作れるようになって、システムを作ったらお金がもらえて、システムを作ったお金でハロヲタがやれる」
                    </ArticleEmphasis>
                    <p>
                        という、とってもLuckyでHappyな経験をさせてもらいました。
                    </p>
                    <ArticleSignature>ありがとうハロー！プロジェクト。</ArticleSignature>
                    <p>
                        一方で、変わっていないのは、本業のハロヲタとしての活動でして、SNS等発信していなかった時期も、ハロプロやM-lineのライブには沢山行っていました。
                    </p>
                    <p>
                        むしろ、安定収入が入ることによって現場の数は年々増加の一途、手が付けられない状況です。
                    </p>
                    <p>
                        ハロプロ自体にも、新グループの結成や、既存グループへの卒業加入をはじめ、サブスク全面解禁等、様々なことがありましたが、なんといっても「盛れ！ミ・アモーレ」の大フィーバーはオリジナル・メンバーのヲタクの私としても、とても嬉しい出来事でした。
                    </p>
                    <p>
                        また、Juice=Juiceのパフォーマンスや楽曲が外の世界に届いてることに驚き、喜びを感じると同時に、そろそろToMoKoを復活させねば。。。と使命感的な何かが生まれてきたのも事実です。
                    </p>
                </ArticleSection>

                <ArticleSection title="リニューアルのきっかけ">
                    <p>
                        そんなこんなで、やりたい気持ちはずっとあったのですが、実際にこのサービスがリニューアルできたのは、生成AIの進化のおかげです。
                    </p>
                    <p>
                        サービス公開当初から、ここの見た目をこうかえたい、こんな技術を使ってこんな機能を作りたい、という構想は頭の中にあったのですが、それを実際に形にするには、調べたり考えたりしなければならないことが多く、リニューアル計画はなかなか前に進みませんでした。
                    </p>
                    <p>
                        AIはそんな私よりも遥かに速いスピードで、もりもりと成長し、気がつけば私の作りたいものはClaude CodeやCodexに指示を出すだけで作れるようになりました。
                    </p>
                    <p>
                        新しいToMoKoは完全にAIの力で作られています。今どき珍しいことではありませんが、自分では1行もコードを書いていません。
                    </p>
                    <p>
                        コーディングだけでなく、セットリストデータの収集、登録、整形等の細かい作業も、AIがちょっとの指示でやってくれるので、かつてより高い頻度でデータ更新ができるようになりました。
                    </p>
                    <ArticleEmphasis>いやぁまったく凄い時代です。</ArticleEmphasis>
                    <p>
                        そんなわけでハロプロセトリ検索システムを作るために必要となる知識と労力は、4年前と比べて限りなく小さくなりました。
                    </p>
                    <p>
                        そもそも気合と根性だけで作っていましたが、今は根性がなくても気合というか、やる気（とAIを使うためのお金）だけで作れます。
                    </p>
                    <ArticleAside>
                        （でも、宮本佳林ちゃんがブラウザゲームを一人で作りだすようになったのは、かなり衝撃的でした。まじスッゲエ。宮本佳林ちゃんなら、確実にハロプロセトリ検索システムを作れます。作る必要はまったくありませんが。）
                    </ArticleAside>
                </ArticleSection>

                <ArticleSection title="ToMoKoの現在地">
                    <p>AIによって、WEB開発の現場は劇的に変化しつつあります。</p>
                    <p>
                        Webそのもののあり方も大きく変わるでしょうし、セトリ検索システムもいつかは役割を終えるかもしれません。
                    </p>
                    <p>
                        ただ、現時点ではSNSの検索はろくに機能せず、AIもハロプロの細かい知識を直接には教えてくれない以上、このように人が一定の基準で判断を行い、整理したデータベースには価値があると思っています。
                    </p>
                    <p>
                        また、誰でも作れるようなサービスではありますが、できるのと実際にやるのでは大きな差があります。
                    </p>
                    <p>
                        私よりもやる気のある人が現れるまで（現れてくれ！！！）は、ぼちぼち更新していけたらなと思っています。
                    </p>
                    <p>
                        現在のToMoKoは、構想の8割ほどはすでに完成している状態です。
                    </p>
                    <p>
                        私個人としては、「こういうものが欲しかった」と思えるサービスにかなり近づいてきました。
                    </p>
                    <p>
                        ここからさらに良いものにしていくためには、実際に使ってくださる皆様のご意見が必要になってくると思っています。
                    </p>
                    <p>
                        前述の通り、機能の追加、改善自体はAIで簡単に行えるようになりました。
                    </p>
                    <ArticleEmphasis>
                        つくれることより価値があるのは、こういうものがほしいという「意図」です。
                    </ArticleEmphasis>
                    <p>
                        「こういう見た目のほうがいい」「こういう機能がほしい」「こういうデータを検索したい」「こういうデータをまとめてほしい」といった要望がありましたら是非教えていただけると幸いです。
                    </p>
                    <p>
                        AIは魔法ではないので、できないこともありますが、色々Tryしてみたいとは思っています。
                    </p>
                    <p>
                        ご意見、ご要望は新設したお問い合わせフォームや、GitHub、Twitterで受け付けています。
                    </p>
                </ArticleSection>

                <ArticleSection title="お願い">
                    <p>もうひとつお願いがあります。セトリの投稿のご協力です。</p>
                    <p>
                        ハロプロセトリ検索システム ToMoKo では、できる限り多くのハロー！プロジェクト関連ライブのセトリを収集することを目指しています。
                    </p>
                    <p>
                        管理人自身もそれなりにハロプロを楽しんでいますが、当然ながらすべての現場に足を運ぶことはできません。
                    </p>
                    <p>
                        ハロプロセトリ検索システムは、古よりアリーナからライブハウスまで365日、ありとあらゆる現場に駆けつけ、それを記録してくれたハロヲタの皆さんの偉大な遺産の上に成り立っています。
                    </p>
                    <p>
                        このたび、セトリ投稿機能を追加しましたので、こちらをご利用いただけると非常にありがたいですが、別の媒体でもかまいません。
                    </p>
                    <p>
                        Twitter、ブログ、掲示板など、誰もがアクセスできるインターネット上のどこかにセトリを残していただきたいです。
                    </p>
                    <ArticleEmphasis>
                        セトリそのものには、大して意味がないかもしれない。
                    </ArticleEmphasis>
                    <p>
                        でも、その裏にあるライブ、ハロプロのパフォーマンスと楽曲と、熱い空間を、セトリを通して少しだけ記録することができるかもしれません。
                    </p>
                    <p>
                        是非、今後のライブも、また過去のセトリについても投稿を検討していただけると幸いです。
                    </p>
                    <ArticleAside>
                        （勿論、セトリとか気にせず、何も考えず楽しく歌って踊るのも最高だとは思うので、好きな方がやっていただければ！）
                    </ArticleAside>
                </ArticleSection>

                <ArticleSection title="最後に">
                    <p>
                        サービス公開当初、ド素人が作ったニッチなサービスとしては多くの反響をいただきました。
                    </p>
                    <p>
                        あのとき褒められたことは、今も胸の中で宝物のように残っています。あの経験がなければエンジニアになろうとは思っていなかったと思います。
                    </p>
                    <p>また、note記事へのサポートもいただきました。</p>
                    <p>
                        エンジニアになる前、食事を抜いて現場にいっていたような時期には本当に大きな助けになりました。
                    </p>
                    <p>この場を借りまして、改めて御礼申し上げます。</p>
                    <p>
                        そして、最後に金澤朋子さん、お誕生日おめでとうございます。
                    </p>
                    <p>勝手に名前をつかってしまい申し訳ありません。</p>
                    <p>
                        ただ、この名前をつけたからには作り上げなくては、と思ってなんとかシステムを完成させられました。
                    </p>
                    <p>
                        この名前をつけたからには復活させなきゃ、と思ってAIの勉強もできました。
                    </p>
                    <p>
                        初めての開発現場、何もわからなくて、不安な気持ちを落ち着かせようとお守りのようにスーツのポケットにFSKを忍ばせていたのを今でもよく思い出します。
                    </p>
                    <p>私は元気で楽しくやっています。</p>
                    <p>
                        まぁずっとヲタクが独りで勝手にやっているんですけど、勝手に朋子のおかげと思いこんでいます。
                    </p>
                    <p>
                        朋子さんも健やかで楽しい生活を送られていることを願っています。
                    </p>
                </ArticleSection>
            </ArticleBody>
        ),
    },
];

export const listArticles = (): Article[] =>
    [...ARTICLES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export const listPublishedArticles = (): Article[] =>
    listArticles().filter((article) => article.status === "published");

export const listLatestPublishedArticles = (limit: number): Article[] =>
    listPublishedArticles().slice(0, Math.max(0, limit));

export const getArticleBySlug = (slug: string): Article | null =>
    ARTICLES.find((article) => article.slug === slug) ?? null;

export const renderArticleTags = (article: Article): ReactNode =>
    article.tags.map((tag) => (
        <span key={`${article.slug}-${tag}`} className={ARTICLE_TAG_CLASS}>
            {tag}
        </span>
    ));
