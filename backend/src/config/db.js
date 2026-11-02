import mongoose from 'mongoose';

export async function conectarBanco(uri) {
  if (!uri) {
    throw new Error('Defina MONGODB_URI no arquivo .env do backend.');
  }

  await mongoose.connect(uri);
}

export async function desconectarBanco() {
  await mongoose.disconnect();
}
