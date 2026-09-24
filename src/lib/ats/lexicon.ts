// All entries are folded (lowercase, no diacritics). Skill aliases are human-readable
// and tokenized at load time with the same tokenizer used for documents.

export const STOPWORDS_EN = new Set(
  (
    "a about above after again against all also am an and any are as at be because been before being below between both but by can " +
    "could did do does doing down during each either etc few for from further had has have having he her here hers him his how however " +
    "i if in into is it its itself just like may me might more most must my no nor not now of off on once only or other our ours out over " +
    "own per same she should so some such than that the their them then there these they this those through to too under until up upon " +
    "us very via was we were what when where which while who whom why will with within without would you your yours yourself eg ie " +
    "e.g i.e etc ll re ve"
  ).split(" "),
);

export const STOPWORDS_PT = new Set(
  (
    "a ao aos aquela aquele aquilo as ate apos assim bem cada com como da das de dela dele deles demais depois do dos e ela elas ele eles " +
    "em entre era essa esse esta estao estar este eu foi for ha isso isto ja la lhe mais mas me mesmo meu minha muito na nas nao nem no " +
    "nos nossa nosso num numa o onde os ou para pela pelas pelo pelos por qual quando que quem se sem ser seu sua suas seus so sobre " +
    "tambem te tem ter teu um uma umas uns voce voces vai sao seja sera tera"
  ).split(" "),
);

/** Words that are frequent in job ads but carry no skill signal. */
export const JOB_NOISE = new Set(
  (
    "experience experiences experienced experiencia experiencias years year anos ano work working trabalho trabalhar team teams equipe equipes " +
    "time company empresa empresas role vaga vagas position cargo candidate candidates candidato candidata candidatos requirements requirement " +
    "required requisitos requisito responsibilities responsibility responsabilidades responsabilidade knowledge conhecimento conhecimentos " +
    "strong forte fortes ability able capacidade skills skill habilidades habilidade desejavel desejaveis diferencial diferenciais plus " +
    "benefits beneficios beneficio salary salario job jobs looking buscamos procuramos buscando join junte opportunity oportunidade " +
    "oportunidades good great excellent bom boa bons boas otimo otima excelente new novo nova novos novas including incluindo using " +
    "utilizando usar use uso related relacionados relacionadas relacionado area areas level nivel well preferred preferencialmente " +
    "minimum minimo least other others outros outras outro outra based baseado baseada help ajudar make fazer want need precisa " +
    "across day dia days dias hands full remote remoto remota hibrido hybrid presencial onsite location local clt pj home office vale " +
    "refeicao alimentacao transporte saude plano odontologico health insurance vacation ferias bonus equity stock options apply " +
    "candidatar descricao description atividades activities principais main key nice possuir sejam multiple various diversos diversas " +
    "varios varias tipo type ensure garantir support suporte including etc wide people pessoas our nosso nossa nossos " +
    "nossas seu sua best melhor melhores world mundo global globais environment ambiente culture cultura mission missao values valores " +
    "process processo processos business negocio negocios solutions solucoes solucao projects projeto projetos product produto produtos " +
    "develop desenvolver development desenvolvimento building build construir create criar responsible responsavel atuar atuacao " +
    "junior pleno senior sr jr mid lead specialist especialista analyst analista engineer engenheiro engenharia developer desenvolvedor " +
    "desenvolvedora desenvolvedores software sistemas sistema system systems tecnologia technology technologies tecnologias field campo " +
    // language proficiency levels
    "basico basic intermediario intermediate avancado advanced fluente fluent fluency fluencia nativo native proficiente proficient"
  ).split(" "),
);

export interface SkillDef {
  id: string;
  label: string;
  /** Matched case-insensitively on folded tokens. */
  aliases: string[];
  /** The bare label is also an everyday word ("Excel" vs "excel in"), so it only counts with exact casing. */
  caseSensitive?: boolean;
  /** Custom pattern (flags "gm") for the bare label when casing alone is not enough. */
  labelRegex?: string;
  soft?: boolean;
}

const s = (label: string, ...aliases: string[]): SkillDef => ({ id: label.toLowerCase(), label, aliases: [label, ...aliases] });
const cs = (label: string, ...aliases: string[]): SkillDef => ({ id: label.toLowerCase(), label, aliases, caseSensitive: true });
const soft = (label: string, ...aliases: string[]): SkillDef => ({ ...s(label, ...aliases), soft: true });

export const SKILLS: SkillDef[] = [
  // Languages
  s("JavaScript", "js", "ecmascript", "es6"),
  s("TypeScript", "ts"),
  s("Python"),
  s("Java"),
  s("C#", "csharp", "c sharp"),
  s("C++", "cpp"),
  // A bare "C" only counts as a list item ("Python, C, Java", "C/C++"), never in
  // "Series C", "C-level" or "John C. Smith".
  {
    ...cs("C", "linguagem c", "c language", "ansi c", "c programming", "programacao em c"),
    labelRegex: "(?<=(?:^|[,/|;:(])[ \\t]*)C(?=[ \\t]*(?:[,/|;)]|$))",
  },
  cs("Go", "golang", "go lang"),
  s("Rust"),
  s("Kotlin"),
  cs("Swift", "swiftui"),
  s("PHP"),
  s("Ruby"),
  s("Scala"),
  s("Dart"),
  s("Elixir"),
  s("SQL"),
  s("NoSQL"),
  s("HTML", "html5"),
  s("CSS", "css3"),
  s("Sass", "scss"),
  s("Bash", "shell script", "shell scripting"),
  s("PowerShell"),
  // Frontend / backend frameworks
  s("React", "reactjs", "react.js"),
  s("React Native"),
  s("Next.js", "nextjs", "next js"),
  s("Vue", "vue.js", "vuejs"),
  s("Angular", "angularjs"),
  s("Svelte"),
  s("Tailwind", "tailwindcss", "tailwind css"),
  s("Redux"),
  s("Node.js", "nodejs", "node"),
  cs("Express", "express.js", "expressjs"),
  s("NestJS", "nest.js"),
  s("Django"),
  s("Flask"),
  s("FastAPI"),
  cs("Spring", "spring framework"),
  s("Spring Boot", "springboot"),
  s(".NET", "dotnet", "asp.net", "asp.net core", ".net core"),
  s("Laravel"),
  cs("Rails", "ruby on rails"),
  s("Flutter"),
  s("Android"),
  s("iOS"),
  s("GraphQL"),
  cs("REST", "restful", "rest api", "rest apis", "api rest", "apis rest"),
  s("gRPC"),
  s("Microservices", "microsservicos", "microservicos", "micro-services", "microservice"),
  s("Frontend", "front end", "front-end"),
  s("Backend", "back end", "back-end"),
  s("Full Stack", "fullstack", "full-stack"),
  // Data stores
  s("PostgreSQL", "postgres"),
  s("MySQL"),
  s("SQLite"),
  s("SQL Server", "mssql"),
  s("Oracle"),
  s("MongoDB", "mongo"),
  s("Redis"),
  s("Elasticsearch"),
  s("DynamoDB"),
  s("Firebase"),
  s("Supabase"),
  s("Prisma"),
  // Cloud / DevOps
  s("Docker"),
  s("Kubernetes", "k8s"),
  s("Terraform"),
  s("Ansible"),
  s("AWS", "amazon web services"),
  s("Azure", "microsoft azure"),
  s("GCP", "google cloud", "google cloud platform"),
  s("Vercel"),
  s("Linux"),
  s("Git"),
  s("GitHub"),
  s("GitLab"),
  s("CI/CD", "cicd", "continuous integration", "integracao continua", "entrega continua", "continuous delivery"),
  s("GitHub Actions"),
  s("Jenkins"),
  s("Nginx"),
  s("Kafka", "apache kafka"),
  s("RabbitMQ"),
  s("Observability", "observabilidade", "monitoring", "monitoramento"),
  // Testing / quality
  s("Jest"),
  s("Vitest"),
  s("Cypress"),
  s("Playwright"),
  s("Selenium"),
  s("JUnit"),
  s("pytest"),
  s("TDD", "test driven development", "test-driven development"),
  s("Unit Testing", "unit tests", "unit test", "testes unitarios", "teste unitario", "testes automatizados", "automated tests"),
  s("Clean Code", "codigo limpo"),
  s("Design Patterns", "padroes de projeto"),
  cs("SOLID", "solid principles", "principios solid"),
  s("OOP", "poo", "object-oriented", "object oriented", "orientacao a objetos", "programacao orientada a objetos"),
  s("Data Structures", "estruturas de dados", "estrutura de dados"),
  s("Algorithms", "algoritmos"),
  // Data / AI
  s("Machine Learning", "aprendizado de maquina", "ml"),
  s("Deep Learning", "aprendizado profundo"),
  s("NLP", "natural language processing", "processamento de linguagem natural"),
  s("LLM", "llms", "large language models", "large language model"),
  s("Pandas"),
  s("NumPy"),
  s("scikit-learn", "sklearn"),
  s("TensorFlow"),
  s("PyTorch"),
  s("Power BI", "powerbi"),
  s("Tableau"),
  cs("Excel", "microsoft excel", "ms excel", "excel avancado", "advanced excel"),
  s("Data Analysis", "analise de dados", "data analytics"),
  s("ETL"),
  cs("Spark", "pyspark", "apache spark"),
  s("Airflow", "apache airflow"),
  // Practices / tools
  s("Agile", "agil", "metodologias ageis", "metodologia agil", "ageis"),
  s("Scrum"),
  s("Kanban"),
  s("Jira"),
  s("Figma"),
  s("UX", "ui/ux", "user experience", "experiencia do usuario"),
  s("Cybersecurity", "information security", "seguranca da informacao", "ciberseguranca", "application security", "appsec"),
  s("OAuth", "oauth2"),
  s("JWT"),
  s("Networking", "redes de computadores", "computer networks", "tcp/ip"),
  s("SAP"),
  s("Salesforce"),
  s("SEO"),
  // Languages & soft skills
  s("English", "ingles"),
  s("Spanish", "espanhol"),
  soft("Communication", "comunicacao"),
  soft("Leadership", "lideranca"),
  soft("Teamwork", "trabalho em equipe"),
  soft("Problem Solving", "resolucao de problemas", "problem-solving"),
];

export const ACTION_VERBS = new Set(
  (
    // English
    "led lead managed manage built build developed develop designed design implemented implement created create improved improve " +
    "increased increase reduced reduce optimized optimize launched launch delivered deliver automated automate migrated migrate " +
    "architected engineered established drove achieved coordinated mentored trained analyzed resolved refactored deployed integrated " +
    "streamlined spearheaded founded owned scaled maintained collaborated contributed wrote tested documented researched supported " +
    "organized planned presented negotiated generated saved accelerated modernized conducted oversaw directed orchestrated " +
    "cofounded cocreated researched investigated prototyped trained shipped set configured facilitated " +
    "researching investigating developing building leading designing implementing creating managing maintaining " +
    // Portuguese (1st/3rd person past, infinitive, noun forms used as bullet openers)
    "desenvolvi desenvolveu desenvolver desenvolvimento liderei liderou liderar gerenciei gerenciou gerenciar criei criou criar " +
    "implementei implementou implementar implementacao projetei projetou construi construiu construir otimizei otimizou otimizar " +
    "reduzi reduziu reduzir aumentei aumentou aumentar automatizei automatizou automatizar automacao migrei migrou migrar migracao " +
    "entreguei entregou coordenei coordenou mentorei treinei analisei analisou resolvi resolveu refatorei refatorou refatoracao " +
    "integrei integrou integracao implantei implantou lancei lancou estruturei estruturou colaborei colaborou contribui contribuiu " +
    "escrevi testei documentei pesquisei apoiei organizei planejei apresentei negociei gerei economizei acelerei modernizei conduzi " +
    "conduziu fundei mantive manteve modelei modelou arquitetei elaborei elaborou"
  ).split(" "),
);

export type SectionId = "summary" | "experience" | "education" | "skills" | "projects" | "certifications" | "languages";

export const SECTION_SYNONYMS: Record<SectionId, string[]> = {
  summary: [
    "summary", "professional summary", "career summary", "profile", "professional profile", "objective", "career objective",
    "resumo", "resumo profissional", "perfil", "perfil profissional", "objetivo", "objetivo profissional", "sumario",
  ],
  experience: [
    "experience", "work experience", "professional experience", "employment", "employment history", "work history",
    "career history", "relevant experience", "experiencia", "experiencias", "experiencia profissional",
    "experiencias profissionais", "historico profissional", "atuacao profissional",
  ],
  education: [
    "education", "academic background", "academic history", "educacao", "formacao", "formacao academica", "escolaridade",
    "formacao educacional",
  ],
  skills: [
    "skills", "technical skills", "core skills", "key skills", "competencies", "core competencies", "technologies",
    "tech stack", "hard skills", "soft skills", "habilidades", "habilidades tecnicas", "competencias", "competencias tecnicas",
    "conhecimentos", "conhecimentos tecnicos", "tecnologias",
  ],
  projects: ["projects", "personal projects", "selected projects", "projetos", "projetos pessoais", "projetos academicos"],
  certifications: [
    "certifications", "certificates", "licenses", "licenses & certifications", "licenses and certifications", "courses",
    "certificacoes", "certificados", "cursos", "cursos e certificacoes", "cursos complementares",
  ],
  languages: ["languages", "idiomas", "linguas"],
};

/** Creative headings that many ATS fail to map, with the standard heading to use instead. */
export const NONSTANDARD_HEADINGS: Record<string, SectionId> = {
  about: "summary",
  "about me": "summary",
  bio: "summary",
  "who i am": "summary",
  sobre: "summary",
  "sobre mim": "summary",
  "quem sou": "summary",
  "quem sou eu": "summary",
  apresentacao: "summary",
  career: "experience",
  journey: "experience",
  "my journey": "experience",
  "where i've worked": "experience",
  carreira: "experience",
  trajetoria: "experience",
  "trajetoria profissional": "experience",
  "minha trajetoria": "experience",
  studies: "education",
  estudos: "education",
  toolbox: "skills",
  "my toolbox": "skills",
  tools: "skills",
  stack: "skills",
  ferramentas: "skills",
  "what i do": "skills",
  "o que eu faco": "skills",
};

// Job-ad section headings (matched on folded lines of at most 60 characters).
export const REQUIREMENT_HEADINGS =
  /\b(requirements|qualifications|must have|what you.ll need|what we.re looking for|you have|you bring|requisitos|qualificacoes|obrigatorio|obrigatorios|o que buscamos|o que esperamos|voce tem|necessario|necessarios)\b/;
export const NICE_TO_HAVE_HEADINGS =
  /\b(nice to have|nice-to-have|bonus points|preferred qualifications|desejavel|desejaveis|diferencial|diferenciais)\b/;
export const NON_REQUIREMENT_HEADINGS =
  /\b(benefits|perks|about us|about the company|who we are|our culture|what we offer|compensation|beneficios|sobre nos|sobre a empresa|quem somos|nossa cultura|oferecemos|o que oferecemos|remuneracao)\b/;
export const NEUTRAL_HEADINGS =
  /\b(responsibilities|what you.ll do|about the role|the role|job description|responsabilidades|atividades|atribuicoes|o que voce vai fazer|sobre a vaga|descricao da vaga)\b/;
