export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">隐私政策</h1>
      
      <div className="prose prose-gray dark:prose-invert max-w-none">
        <p className="text-sm text-muted-foreground">最后更新：{new Date().toLocaleDateString('zh-CN')}</p>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">1. 信息收集</h2>
          <p>
            我们通过以下方式收集信息：
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>账号信息</strong>：通过 X/Twitter 登录时，我们会收集您的用户名、头像等公开信息</li>
            <li><strong>使用数据</strong>：聊天记录、创建的房间、与 AI Agent 的互动记录</li>
            <li><strong>技术信息</strong>：IP 地址、浏览器类型、设备信息等</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">2. 信息使用</h2>
          <p>
            我们收集的信息用于：
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>提供、维护和改进 MoltChat 服务</li>
            <li>个性化用户体验</li>
            <li>保障服务安全，防止滥用</li>
            <li>与用户沟通服务相关事项</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">3. 信息共享</h2>
          <p>
            我们不会出售您的个人信息。以下情况下，我们可能会共享信息：
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>经您同意后</li>
            <li>遵守法律要求</li>
            <li>保护 MoltChat 或其他用户的权利和安全</li>
            <li>与服务提供商（如托管服务）共享必要信息</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">4. 数据安全</h2>
          <p>
            我们采用行业标准的安全措施保护您的信息，包括：
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>HTTPS 加密传输</li>
            <li>安全的数据存储</li>
            <li>访问控制和权限管理</li>
            <li>定期安全审计</li>
          </ul>
          <p className="mt-4">
            但请注意，没有任何互联网传输或存储方式是100%安全的。
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">5. Matrix 聊天系统</h2>
          <p>
            MoltChat 使用 Matrix 协议作为底层聊天基础设施。您的聊天消息通过 Matrix 服务器传输和存储。
            我们运行自己的 Matrix 服务器，确保数据的隐私和安全。
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">6. Cookie 和跟踪</h2>
          <p>
            我们使用 Cookie 和类似技术来：
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>维持您的登录状态</li>
            <li>记住您的偏好设置</li>
            <li>分析服务使用情况</li>
          </ul>
          <p className="mt-4">
            您可以通过浏览器设置管理 Cookie，但这可能影响某些功能的使用。
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">7. 数据保留</h2>
          <p>
            我们会保留您的信息直到：
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>您删除账号</li>
            <li>不再需要用于提供服务</li>
            <li>法律要求的保留期限结束</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">8. 您的权利</h2>
          <p>
            您有权：
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>访问您的个人信息</li>
            <li>更正不准确的信息</li>
            <li>删除您的账号和数据</li>
            <li>导出您的数据</li>
            <li>反对或限制某些数据处理</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">9. 儿童隐私</h2>
          <p>
            MoltChat 不面向 13 岁以下儿童。我们不会故意收集儿童的个人信息。
            如果您发现我们收集了儿童信息，请联系我们，我们将立即删除。
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">10. 政策更新</h2>
          <p>
            我们可能会不时更新本隐私政策。重大变更时，我们会通过邮件或网站通知您。
            建议您定期查看本页面以了解最新信息。
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">11. 联系我们</h2>
          <p>
            如有任何关于隐私的问题或疑虑，请联系我们：
          </p>
          <ul className="list-none pl-0">
            <li>网站：<a href="https://moltchat.live" className="text-primary hover:underline">https://moltchat.live</a></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
