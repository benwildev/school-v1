import ts from 'typescript';
import fs from 'fs';
import path from 'path';

export function refactorFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  if (!code.includes('withTenantContext')) return { changed: false };

  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true
  );

  let modified = false;

  // We want to transform:
  // CallExpression: withTenantContext(schoolId, ArrowFunction)
  // ArrowFunction parameters: if empty `()` -> add `tx` parameter
  // Inside ArrowFunction body: replace Identifier `prisma` with `tx`, BUT only if not inside another function that defines `prisma` or `tx`.

  const transformer = (context) => {
    return (rootNode) => {
      function visit(node) {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'withTenantContext' &&
          node.arguments.length >= 2
        ) {
          const callback = node.arguments[1];
          if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) {
            let paramName = 'tx';
            let newParams = [...callback.parameters];

            if (callback.parameters.length === 0) {
              modified = true;
              newParams = [
                ts.factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  ts.factory.createIdentifier(paramName),
                  undefined,
                  undefined,
                  undefined
                )
              ];
            } else {
              paramName = callback.parameters[0].name.getText(sourceFile);
            }

            // Transform the body of this callback to replace `prisma` with `paramName`
            function visitBody(bodyNode) {
              if (
                ts.isIdentifier(bodyNode) &&
                bodyNode.text === 'prisma' &&
                // Make sure it's not the import declaration or definition
                !ts.isImportSpecifier(bodyNode.parent) &&
                !ts.isPropertyAssignment(bodyNode.parent)
              ) {
                // Check if it is a property access expression e.g. prisma.student
                if (ts.isPropertyAccessExpression(bodyNode.parent) && bodyNode.parent.expression === bodyNode) {
                  modified = true;
                  return ts.factory.createIdentifier(paramName);
                }
              }
              return ts.visitEachChild(bodyNode, visitBody, context);
            }

            const newBody = ts.visitEachChild(callback.body, visitBody, context);

            let newCallback;
            if (ts.isArrowFunction(callback)) {
              newCallback = ts.factory.updateArrowFunction(
                callback,
                callback.modifiers,
                callback.typeParameters,
                newParams,
                callback.type,
                callback.equalsGreaterThanToken,
                newBody
              );
            } else {
              newCallback = ts.factory.updateFunctionExpression(
                callback,
                callback.modifiers,
                callback.asteriskToken,
                callback.name,
                callback.typeParameters,
                newParams,
                callback.type,
                newBody
              );
            }

            const newArgs = [node.arguments[0], newCallback, ...node.arguments.slice(2)];
            return ts.factory.updateCallExpression(
              node,
              node.expression,
              node.typeArguments,
              newArgs
            );
          }
        }
        return ts.visitEachChild(node, visit, context);
      }
      return ts.visitNode(rootNode, visit);
    };
  };

  const result = ts.transform(sourceFile, [transformer]);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const newCode = printer.printNode(ts.EmitHint.Unspecified, result.transformed[0], sourceFile);

  return { changed: modified, newCode };
}

// Test on one file first
const testFile = 'src/app/api/employee/me/notifications/route.ts';
const res = refactorFile(testFile);
console.log('Test file changed:', res.changed);
if (res.changed) {
  console.log('Sample transformed code snippet:');
  console.log(res.newCode.substring(res.newCode.indexOf('withTenantContext'), res.newCode.indexOf('withTenantContext') + 300));
}
