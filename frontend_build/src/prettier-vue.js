const prettier = require('prettier');
const compiler = require('vue-template-compiler');
const fs = require('fs');
const path = require('path');

function prettierVue({ file, write, encoding = 'utf-8', prettierOptions }) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, { encoding }, (err, buffer) => {
      if (err) {
        reject(err.message);
        return;
      }
      const source = buffer.toString();
      const vueComponent = compiler.parseComponent(source);
      let formatted;
      const options = Object.assign(
        {
          filepath: file,
        },
        prettierOptions
      );
      try {
        // Raw JS file, so assume is raw javascript to format.
        if (file.endsWith('.js')) {
          formatted = prettier.format(source, options);
        } else if (vueComponent && vueComponent.script) {
          const start = vueComponent.script.start;
          const end = vueComponent.script.end;
          let formattedJs = prettier.format(source.slice(start, end), options);
          // Ensure that the beginning and end of the JS has two newlines to fit our
          // Component linting conventions
          // Ensure it is indented by two spaces
          formattedJs = formattedJs.replace(/^(\n)*/, '\n\n');
          formattedJs = formattedJs.replace(/(\n)*$/, '\n\n');
          formattedJs = formattedJs.replace(/(.*\S.*)/g, '  $1');
          // Return reformatted Vue component, by replacing existing JS in component
          // with the linted code.
          formatted = source.replace(source.slice(start, end), formattedJs);
        }
      } catch (e) {}
      if (!formatted) {
        // Something went wrong, return the source to be safe.
        resolve(source);
        return;
      }
      if (write) {
        if (formatted !== source) {
          fs.writeFile(file, formatted, { encoding }, error => {
            if (error) {
              reject(error.message);
              return;
            }
            console.log(`Rewriting a prettier version of ${file}`);
            resolve('success!');
          });
        }
      } else {
        resolve(formatted);
      }
    });
  });
}

if (require.main === module) {
  const program = require('commander');
  const glob = require('glob');

  program
    .version('0.0.1')
    .usage('[options] <file>')
    .arguments('<file>')
    .option('-w, --write', 'Write to file', false)
    .option('-e, --encoding <string>', 'Text encoding of file', 'utf-8')
    .option('--prettierPath <filePath>', 'Path to prettier bin')
    .parse(process.argv);
  const file = program.args[0];
  const baseOptions = Object.assign({}, program);
  if (baseOptions.prettierPath) {
    baseOptions.prettierOptions = require(path.resolve(process.cwd(), baseOptions.prettierPath));
    delete baseOptions.prettierPath;
  }
  const logSuccess = formatted => {
    if (!baseOptions.write) {
      console.log(formatted);
    }
  };
  if (!file) {
    program.help();
  } else {
    if (glob.hasMagic(file)) {
      glob(file, (err, matches) => {
        if (err) {
          console.log('Error: ', err);
        } else {
          matches.forEach(globbedFile => {
            prettierVue(Object.assign({}, baseOptions, { file: globbedFile }))
              .then(logSuccess)
              .catch(error => console.log('Error: ', error));
          });
        }
      });
    } else {
      prettierVue(Object.assign({}, baseOptions, { file }))
        .then(logSuccess)
        .catch(error => console.log('Error: ', error));
    }
  }
}

module.exports = prettierVue;
