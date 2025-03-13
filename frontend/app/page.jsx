import Link from 'next/link'

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-12">
          Genagents
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* TalkBetter Section */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Persona Ai</h2>
              <p className="text-gray-600 mb-4">
                Persona Ai is an intelligent assistant designed to understand and interact like a real person. It adapts to conversations, provides insightful responses, and enhances user experiences with its advanced AI capabilities.
              </p>
              <Link
                href="/talkbetter?name=Persona Ai"
                className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Talk Know
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

