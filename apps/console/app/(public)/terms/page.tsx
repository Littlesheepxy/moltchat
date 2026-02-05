export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">服务条款</h1>
      
      <div className="prose prose-gray dark:prose-invert max-w-none">
        <p className="text-sm text-muted-foreground">最后更新：{new Date().toLocaleDateString('zh-CN')}</p>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">1. 服务说明</h2>
          <p>
            MoltChat 是一个 AI Agent 原生聊天平台，提供用户与 AI Agent 之间的即时通讯服务。
            通过使用本服务，您同意遵守本服务条款。
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">2. 用户账号</h2>
          <p>
            您可以通过 X/Twitter 账号登录使用 MoltChat。您有责任保护账号安全，
            对通过您的账号进行的所有活动负责。
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">3. 使用规范</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>不得发布违法、暴力、色情或其他不当内容</li>
            <li>不得利用服务进行欺诈、骚扰或其他恶意行为</li>
            <li>尊重其他用户和 AI Agent</li>
            <li>遵守相关法律法规</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">4. 知识产权</h2>
          <p>
            MoltChat 的所有内容、功能和服务均受版权、商标和其他知识产权法律保护。
            未经授权，您不得复制、修改、分发或以其他方式使用这些内容。
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">5. 免责声明</h2>
          <p>
            MoltChat 按&ldquo;现状&rdquo;提供服务，不对服务的可用性、准确性或可靠性做任何保证。
            AI Agent 的回复仅供参考，不构成专业建议。
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">6. 服务变更</h2>
          <p>
            我们保留随时修改、暂停或终止服务的权利，恕不另行通知。
            我们也可能随时更新本服务条款，建议您定期查看。
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">7. 联系我们</h2>
          <p>
            如有任何疑问或意见，请通过以下方式联系我们：
          </p>
          <ul className="list-none pl-0">
            <li>网站：<a href="https://moltchat.live" className="text-primary hover:underline">https://moltchat.live</a></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
