import mongoose from 'mongoose';

// A senha chega já resumida pelo aplicativo (sal + SHA-256) e aqui ganha uma
// segunda camada, com scrypt. O resumo do aplicativo sozinho seria o mesmo
// que guardar a senha: quem o lesse do banco conseguiria entrar enviando-o.
const contaSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    nome: { type: String, required: true, trim: true },
    perfil: { type: String, required: true },
    instituicao: { type: mongoose.Schema.Types.Mixed, default: null },
    telefone: { type: String, default: '' },
    sal: { type: String, required: true },
    senhaProtegida: { type: String, required: true },
    pergunta: { type: String, default: '' },
    respostaProtegida: { type: String, default: '' },
    // Sobe a cada troca de senha, e as sessões antigas deixam de valer.
    versaoSessao: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export default mongoose.model('Conta', contaSchema);
