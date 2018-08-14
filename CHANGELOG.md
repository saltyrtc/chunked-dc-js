# Changelog

This project follows semantic versioning.

Possible log types:

- `[added]` for new features.
- `[changed]` for changes in existing functionality.
- `[deprecated]` for once-stable features removed in upcoming releases.
- `[removed]` for deprecated features removed in this release.
- `[fixed]` for any bug fixes.
- `[security]` to invite users to upgrade in case of vulnerabilities.


### v1.1.1 (2018-08-14)

- [fixed] Add `HEADER_LENGTH` constant to type declarations

### v1.1.0 (2018-07-26)

- [added] Expose `HEADER_LENGTH` constant

### v1.0.0 (2016-12-17)

- No change compared to v0.2.3. But the relase should be stable now.

### v0.2.3 (2016-10-19)

- [removed] Don't copy the type declarations to the dist directory. It confuses TypeScript.

### v0.2.2 (2016-10-17)

- [added] Add "module" and "types" fields to package.json

### v0.2.1 (2016-10-17)

- [changed] Make polyfills in ES5 distribution optional

### v0.2.0 (2016-10-17)

- [changed] Specified chunk size now includes header size

### v0.1.2 (2016-10-13)

- [changed] Switch from browserify to rollup

### v0.1.1 (2016-09-07)

- [added] Implement support for chunk context

### v0.1.0 (2016-09-05)

- Initial release
