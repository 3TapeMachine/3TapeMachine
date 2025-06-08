import { defineConfig } from "eslint/config";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);
const compat = new FlatCompat({
  baseDirectory: _dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default defineConfig([{
  extends: compat.extends("eslint:recommended"),

  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
      ...globals.mocha,
    },

    ecmaVersion: 2021,
    sourceType: "module",
  },

  rules: {
    indent: [1, 2, {
      SwitchCase: 1,
      VariableDeclarator: {
        var: 2,
      },
    }],

    "linebreak-style": [2, "unix"],
    semi: [1, "always"],

    "space-before-function-paren": [1, {
      anonymous: "always",
      named: "never",
    }],

    "consistent-this": [1, "self"],
    "prefer-const": 2,
    "no-var": 2,
    "arrow-body-style": [1, "as-needed"],
    "object-shorthand": 1,
    "no-invalid-this": 2,
    "no-shadow": [2, {
      builtinGlobals: true,
    }],

    "no-shadow-restricted-names": 2,
    "no-unexpected-multiline": 2,
    strict: [2, "global"],
  },
}]);