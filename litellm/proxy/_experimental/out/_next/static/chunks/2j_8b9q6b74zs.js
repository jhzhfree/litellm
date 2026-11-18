(()=>{"use strict";(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,191905,e=>{var n=e.i(843476),r=e.i(322831),a=e.i(466828),t=e.i(677572),s=e.i(778917),i=e.i(196631);let o=({href:e,className:a})=>{let{t}=(0,r.f)();return(0,n.jsxs)("a",{href:e,target:"_blank",rel:"noopener noreferrer",title:t("apiReference.docLink.title"),className:(0,i.c)("inline-flex items-center gap-2 rounded-xl border border-border bg-card/80 px-3.5 py-2 text-sm font-medium text-foreground shadow-xs","hover:bg-card focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring active:translate-y-[0.5px]",a),children:[(0,n.jsx)("span",{children:t("apiReference.docLink.label")}),(0,n.jsx)(s.f,{"aria-hidden":!0,className:"h-4 w-4 opacity-80"}),(0,n.jsx)("span",{className:"sr-only",children:t("apiReference.docLink.newTab")})]})};var l=e.i(414971);let d=({proxySettings:e})=>{let{t:s}=(0,r.f)(),i="<your_proxy_base_url>",d=e?.LITELLM_UI_API_DOC_BASE_URL;return d&&d.trim()?i=d:e?.PROXY_BASE_URL&&(i=e.PROXY_BASE_URL),(0,n.jsx)("div",{className:"grid grid-cols-1 gap-2 p-8 h-[80vh] w-full mt-2",children:(0,n.jsxs)("div",{className:"mb-5",children:[(0,n.jsxs)("div",{className:"flex items-center justify-between",children:[(0,n.jsx)("h1",{className:"text-2xl font-semibold text-foreground",children:s("apiReference.view.title")}),(0,n.jsx)(o,{className:"ml-3 shrink-0",href:"/docs"})]}),(0,n.jsxs)("p",{className:"mt-2 mb-2 text-sm text-muted-foreground",children:[s("apiReference.view.description")," "]}),(0,n.jsxs)(t.i,{defaultValue:"openai",children:[(0,n.jsxs)(t.U,{variant:"line",className:"border-b rounded-none w-full justify-start h-auto p-0",children:[(0,n.jsx)(t.k,{value:"openai",className:"rounded-none px-4 py-2 flex-none",children:l.f.openAIPythonSdk}),(0,n.jsx)(t.k,{value:"llamaindex",className:"rounded-none px-4 py-2 flex-none",children:l.f.llamaIndex}),(0,n.jsx)(t.k,{value:"langchain",className:"rounded-none px-4 py-2 flex-none",children:l.f.langchainPython})]}),(0,n.jsx)(t.S,{value:"openai",keepMounted:!0,children:(0,n.jsx)(a.f,{language:"python",code:`import openai
client = openai.OpenAI(
    api_key="your_api_key",
    base_url="${i}" # AI-GovernanceGw is OpenAI compatible, Read More: /docs
)

response = client.chat.completions.create(
    model="gpt-3.5-turbo", # model to send to the proxy
    messages = [
        {
            "role": "user",
            "content": "this is a test request, write a short poem"
        }
    ]
)

print(response)`})}),(0,n.jsx)(t.S,{value:"llamaindex",keepMounted:!0,children:(0,n.jsx)(a.f,{language:"python",code:`import os, dotenv

from llama_index.llms import AzureOpenAI
from llama_index.embeddings import AzureOpenAIEmbedding
from llama_index import VectorStoreIndex, SimpleDirectoryReader, ServiceContext

llm = AzureOpenAI(
    engine="azure-gpt-3.5",               # model_name on AI-GovernanceGw
    temperature=0.0,
    azure_endpoint="${i}", # AI-GovernanceGw endpoint
    api_key="<your-virtual-key>",          # AI-GovernanceGw API Key
    api_version="2023-07-01-preview",
)

embed_model = AzureOpenAIEmbedding(
    deployment_name="azure-embedding-model",
    azure_endpoint="${i}",
    api_key="<your-virtual-key>",
    api_version="2023-07-01-preview",
)

documents = SimpleDirectoryReader("llama_index_data").load_data()
service_context = ServiceContext.from_defaults(llm=llm, embed_model=embed_model)
index = VectorStoreIndex.from_documents(documents, service_context=service_context)

query_engine = index.as_query_engine()
response = query_engine.query("What did the author do growing up?")
print(response)`})}),(0,n.jsx)(t.S,{value:"langchain",keepMounted:!0,children:(0,n.jsx)(a.f,{language:"python",code:`from langchain.chat_models import ChatOpenAI
from langchain.prompts.chat import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
)
from langchain.schema import HumanMessage, SystemMessage

chat = ChatOpenAI(
    openai_api_base="${i}",
    model = "gpt-3.5-turbo",
    temperature=0.1
)

messages = [
    SystemMessage(
        content="You are a helpful assistant that im using to make a test request to."
    ),
    HumanMessage(
        content="test from AI-GovernanceGw. tell me why it's amazing in 1 sentence"
    ),
]
response = chat(messages)

print(response)`})})]})]})})};var c=e.i(541202),m=e.i(135214),p=e.i(592392);e.s(["default",0,()=>{let{t:e}=(0,r.f)(),{accessToken:a}=(0,m.f)(),t=(0,p.U)(a);return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(c.f,{featureName:e("apiReference.page.featureName")}),(0,n.jsx)(d,{proxySettings:t})]})}],191905)},541202,e=>{var n=e.i(843476),r=e.i(345771),a=e.i(322831),t=e.i(522016),s=e.i(952571),i=e.i(929592);e.s(["f",0,({featureName:e})=>{let{t:o}=(0,a.f)();return(0,n.jsxs)(i.J,{className:"mb-4",children:[(0,n.jsx)(s.f,{}),(0,n.jsx)(i.s,{children:o("shell.deprecationBanner.title",{featureName:e})}),(0,n.jsx)(i.p,{children:(0,n.jsx)(r.f,{i18nKey:"shell.deprecationBanner.description",components:{feature:(0,n.jsx)(n.Fragment,{children:e}),discussion:(0,n.jsx)(t.default,{href:"/docs",target:"_blank",rel:"noopener noreferrer"})}})})]})}])}])})();