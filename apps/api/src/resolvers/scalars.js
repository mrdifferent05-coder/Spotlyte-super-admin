// scalars.js — JSON passthrough scalar (+ Upload stub kept schema-compatible).
import { GraphQLScalarType, Kind } from 'graphql';

function parseLiteral(ast) {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.OBJECT: {
      const out = {};
      for (const f of ast.fields) out[f.name.value] = parseLiteral(f.value);
      return out;
    }
    case Kind.LIST:
      return ast.values.map(parseLiteral);
    case Kind.NULL:
      return null;
    default:
      return null;
  }
}

export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize: (v) => v,
  parseValue: (v) => v,
  parseLiteral,
});

export const UploadScalar = new GraphQLScalarType({
  name: 'Upload',
  description: 'File upload placeholder (owner-app compatibility)',
  serialize: (v) => v,
  parseValue: (v) => v,
  parseLiteral: () => null,
});
