const path = require('path');

module.exports = {
  entry: './bridge.js', // Point d'entrée principal
  output: {
    filename: 'bridge.bundle.js', // Nom du fichier de sortie
    path: path.resolve(__dirname, 'dist2'), // Répertoire de sortie
  },
  mode: 'production', // Mode production pour un bundle optimisé
  module: {
    rules: [
      {
        test: /\.js$/, // Transpile tous les fichiers JS
        exclude: /node_modules/, // Ignore node_modules
        use: {
          loader: 'babel-loader', // Utilise Babel pour la transpilation
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
    ],
  },
};
