import mongoose from 'mongoose';

// Abrigo, necessidade, doação e compromisso têm muitos campos opcionais que
// mudam junto com as telas. Só o que o servidor usa para decidir permissão é
// declarado; o resto é guardado como veio (strict: false). O id é criado pelo
// aplicativo, porque o registro nasce no celular, mesmo sem internet.
function registro(nome, campos) {
  const schema = new mongoose.Schema(
    {
      id: { type: String, required: true, unique: true },
      ...campos,
    },
    { strict: false, timestamps: true, versionKey: false }
  );

  return mongoose.model(nome, schema);
}

export const Abrigo = registro('Abrigo', {
  dono: { type: String, required: true, lowercase: true, index: true },
});

export const Necessidade = registro('Necessidade', {
  criadoPor: { type: String, required: true, lowercase: true },
  abrigoId: { type: String, index: true },
});

export const Doacao = registro('Doacao', {
  conta: { type: String, required: true, lowercase: true, index: true },
});

export const Compromisso = registro('Compromisso', {
  conta: { type: String, required: true, lowercase: true, index: true },
});

// O mapa precisa da foto sem enviar sessão, por isso ela é servida por um
// endereço público com id aleatório. Fica no banco para não depender de disco:
// hospedagem gratuita apaga os arquivos a cada reinício.
const arquivoSchema = new mongoose.Schema(
  {
    dono: { type: String, required: true, lowercase: true },
    mime: { type: String, required: true },
    dados: { type: Buffer, required: true },
  },
  { timestamps: true }
);

export const Arquivo = mongoose.model('Arquivo', arquivoSchema);
