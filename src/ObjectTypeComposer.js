/* @flow strict */
/* eslint-disable no-use-before-define */

import { GraphQLObjectType, GraphQLInputObjectType, GraphQLInterfaceType } from './graphql';
import type {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLOutputType,
  GraphQLInputType,
  GraphQLIsTypeOfFn,
  GraphQLResolveInfo,
  GraphQLFieldResolver,
  FieldDefinitionNode,
  InputValueDefinitionNode,
} from './graphql';
import { InputTypeComposer } from './InputTypeComposer';
import type { TypeAsString, TypeDefinitionString } from './TypeMapper';
import {
  InterfaceTypeComposer,
  type InterfaceTypeComposerDefinition,
  type InterfaceTypeComposerThunked,
} from './InterfaceTypeComposer';
import {
  Resolver,
  type ResolverDefinition,
  type ResolverNextRpCb,
  type ResolverWrapCb,
  type ResolverMiddleware,
} from './Resolver';
import { SchemaComposer } from './SchemaComposer';
import { ListComposer } from './ListComposer';
import { NonNullComposer } from './NonNullComposer';
import { ThunkComposer } from './ThunkComposer';
import { TypeMapper } from './TypeMapper';
import { resolveMaybeThunk, upperFirst, inspect, mapEachKey } from './utils/misc';
import { isObject, isFunction, isString } from './utils/is';
import {
  defineFieldMap,
  convertObjectFieldMapToConfig,
  convertInterfaceArrayAsThunk,
} from './utils/configToDefine';
import { toInputObjectType } from './utils/toInputObjectType';
import { typeByPath, type TypeInPath } from './utils/typeByPath';
import { getComposeTypeName, unwrapOutputTC, unwrapInputTC } from './utils/typeHelpers';
import type { ProjectionType } from './utils/projection';
import type {
  ObjMap,
  ObjMapReadOnly,
  Thunk,
  Extensions,
  ExtensionsDirective,
  DirectiveArgs,
} from './utils/definitions';
import { graphqlVersion } from './utils/graphqlVersion';
import type {
  ComposeNamedInputType,
  ComposeInputType,
  ComposeInputTypeDefinition,
  ComposeOutputTypeDefinition,
  ComposeOutputType,
  ComposeNamedOutputType,
} from './utils/typeHelpers';
import { createThunkedObjectProxy } from './utils/createThunkedObjectProxy';

export type ObjectTypeComposerDefinition<TSource, TContext> =
  | TypeAsString
  | TypeDefinitionString
  | ObjectTypeComposerAsObjectDefinition<TSource, TContext>
  | $ReadOnly<ObjectTypeComposer<TSource, TContext>>
  | $ReadOnly<GraphQLObjectType>;

export type ObjectTypeComposerAsObjectDefinition<TSource, TContext> = {
  name: string,
  interfaces?: null | Thunk<$ReadOnlyArray<InterfaceTypeComposerDefinition<any, TContext>>>,
  fields?: ObjectTypeComposerFieldConfigMapDefinition<TSource, TContext>,
  isTypeOf?: null | GraphQLIsTypeOfFn<TSource, TContext>,
  description?: string | null,
  isIntrospection?: boolean,
  extensions?: Extensions,
};

export type ObjectTypeComposerFieldConfigMap<TSource, TContext> = ObjMap<
  ObjectTypeComposerFieldConfig<TSource, TContext>
>;
export type ObjectTypeComposerFieldConfigMapDefinition<TSource, TContext> = ObjMapReadOnly<
  Thunk<ObjectTypeComposerFieldConfigDefinition<TSource, TContext>>
>;

export type ObjectTypeComposerFieldConfigDefinition<TSource, TContext, TArgs = ArgsMap> =
  | ObjectTypeComposerFieldConfigAsObjectDefinition<TSource, TContext, TArgs>
  | ComposeOutputTypeDefinition<TContext>
  | $ReadOnly<Resolver<any, TContext, any>>
  | $ReadOnly<ComposeOutputType<TContext>>;

export type ObjectTypeComposerFieldConfigAsObjectDefinition<TSource, TContext, TArgs = ArgsMap> = {
  type: Thunk<ComposeOutputTypeDefinition<TContext> | $ReadOnly<Resolver<any, TContext, any>>>,
  args?: ObjectTypeComposerArgumentConfigMapDefinition<TArgs>,
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>,
  subscribe?: GraphQLFieldResolver<TSource, TContext>,
  deprecationReason?: string | null,
  description?: string | null,
  extensions?: Extensions,
  [key: string]: any,
};

export type ObjectTypeComposerFieldConfig<TSource, TContext, TArgs = ArgsMap> = {
  type: ComposeOutputType<TContext>,
  args?: ObjectTypeComposerArgumentConfigMap<TArgs>,
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>,
  subscribe?: GraphQLFieldResolver<TSource, TContext>,
  deprecationReason?: string | null,
  description?: string | null,
  astNode?: FieldDefinitionNode | null,
  extensions?: Extensions,
  [key: string]: any,
};

// Compose Args -----------------------------

export type ArgsMap = { [argName: string]: any };

export type ObjectTypeComposerArgumentConfigMap<TArgs = ArgsMap> = {
  [argName: $Keys<TArgs>]: ObjectTypeComposerArgumentConfig,
};

export type ObjectTypeComposerArgumentConfigMapDefinition<TArgs = ArgsMap> = {
  +[argName: $Keys<TArgs>]: Thunk<ObjectTypeComposerArgumentConfigDefinition>,
};

export type ObjectTypeComposerArgumentConfigAsObjectDefinition = {
  type: Thunk<ComposeInputTypeDefinition>,
  defaultValue?: any,
  description?: string | null,
  extensions?: Extensions,
  [key: string]: any,
};

export type ObjectTypeComposerArgumentConfig = {
  type: ComposeInputType,
  defaultValue?: any,
  description?: string | null,
  astNode?: InputValueDefinitionNode | null,
  extensions?: Extensions,
  [key: string]: any,
};

export type ObjectTypeComposerArgumentConfigDefinition =
  | ObjectTypeComposerArgumentConfigAsObjectDefinition
  | ComposeInputTypeDefinition;

// RELATION -----------------------------

export type ObjectTypeComposerRelationThunkMap<TSource, TContext> = {
  [fieldName: string]: Thunk<ObjectTypeComposerRelationOpts<any, TSource, TContext, ArgsMap>>,
};
export type ObjectTypeComposerRelationOpts<TRelationSource, TSource, TContext, TArgs = ArgsMap> =
  | ObjectTypeComposerRelationOptsWithResolver<TRelationSource, TSource, TContext, TArgs>
  | ObjectTypeComposerFieldConfigAsObjectDefinition<TSource, TContext, TArgs>;
export type ObjectTypeComposerRelationOptsWithResolver<
  TRelationSource,
  TSource,
  TContext,
  TArgs = ArgsMap
> = {
  +resolver: Thunk<Resolver<TRelationSource, TContext, TArgs>>,
  +prepareArgs?: ObjectTypeComposerRelationArgsMapper<TSource, TContext, TArgs>,
  +projection?: ProjectionType,
  +description?: string | null,
  +deprecationReason?: string | null,
  +catchErrors?: boolean,
};

export type ObjectTypeComposerRelationArgsMapperFn<TSource, TContext, TArgs = ArgsMap> = (
  source: TSource,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => any;
export type ObjectTypeComposerRelationArgsMapper<TSource, TContext, TArgs = ArgsMap> = {
  [argName: $Keys<TArgs>]:
    | { [key: string]: any }
    | ObjectTypeComposerRelationArgsMapperFn<TSource, TContext, TArgs>
    | null
    | void
    | string
    | number
    | any[],
};

export type ObjectTypeComposerGetRecordIdFn<TSource, TContext> = (
  source: TSource,
  args?: ArgsMap,
  context?: TContext
) => string;

export type ObjectTypeComposerThunked<TReturn, TContext> =
  | ObjectTypeComposer<TReturn, TContext>
  | ThunkComposer<ObjectTypeComposer<TReturn, TContext>, GraphQLObjectType>;

export class ObjectTypeComposer<TSource, TContext> {
  schemaComposer: SchemaComposer<TContext>;
  _gqType: GraphQLObjectType;
  _gqcInputTypeComposer: void | InputTypeComposer<TContext>;
  _gqcResolvers: void | Map<string, Resolver<TSource, TContext>>;
  _gqcGetRecordIdFn: void | ObjectTypeComposerGetRecordIdFn<TSource, TContext>;
  _gqcRelations: void | ObjectTypeComposerRelationThunkMap<TSource, TContext>;
  _gqcFields: ObjectTypeComposerFieldConfigMap<TSource, TContext>;
  _gqcInterfaces: Array<InterfaceTypeComposerThunked<TSource, TContext>>;
  _gqcExtensions: void | Extensions;

  static create<TSrc, TCtx>(
    typeDef: ObjectTypeComposerDefinition<TSrc, TCtx>,
    schemaComposer: SchemaComposer<TCtx>
  ): ObjectTypeComposer<TSrc, TCtx> {
    if (!(schemaComposer instanceof SchemaComposer)) {
      throw new Error(
        'You must provide SchemaComposer instance as a second argument for `ObjectTypeComposer.create(typeDef, schemaComposer)`'
      );
    }

    if (schemaComposer.hasInstance(typeDef, ObjectTypeComposer)) {
      return schemaComposer.getOTC(typeDef);
    }

    const tc = this.createTemp(typeDef, schemaComposer);
    const typeName = tc.getTypeName();
    if (typeName !== 'Query' && typeName !== 'Mutation' && typeName !== 'Subscription') {
      schemaComposer.add(tc);
    }
    return tc;
  }

  static createTemp<TSrc, TCtx>(
    typeDef: ObjectTypeComposerDefinition<TSrc, TCtx>,
    schemaComposer?: SchemaComposer<TCtx>
  ): ObjectTypeComposer<TSrc, TCtx> {
    const sc = schemaComposer || new SchemaComposer();
    let TC;

    if (isString(typeDef)) {
      const typeName: string = typeDef;
      if (TypeMapper.isTypeNameString(typeName)) {
        TC = new ObjectTypeComposer(
          new GraphQLObjectType({
            name: typeName,
            fields: () => ({}),
          }),
          sc
        );
      } else {
        TC = sc.typeMapper.convertSDLTypeDefinition(typeName);
        if (!(TC instanceof ObjectTypeComposer)) {
          throw new Error(
            'You should provide correct GraphQLObjectType type definition. ' +
              'Eg. `type MyType { name: String }`'
          );
        }
      }
    } else if (typeDef instanceof GraphQLObjectType) {
      TC = new ObjectTypeComposer(typeDef, sc);
    } else if (typeDef instanceof ObjectTypeComposer) {
      return typeDef;
    } else if (isObject(typeDef)) {
      const type = new GraphQLObjectType({
        ...(typeDef: any),
        fields: () => ({}),
      });
      TC = new ObjectTypeComposer(type, sc);

      const fields = (typeDef: any).fields;
      if (isFunction(fields)) {
        // `convertOutputFieldMapToConfig` helps to solve hoisting problems
        // rewrap fields `() => { f1: { type: A } }` -> `{ f1: { type: () => A } }`
        TC.addFields(convertObjectFieldMapToConfig(fields, sc));
      } else if (isObject(fields)) {
        TC.addFields(fields);
      }

      const interfaces = (typeDef: any).interfaces;
      if (Array.isArray(interfaces)) TC.setInterfaces(interfaces);
      else if (isFunction(interfaces)) {
        // rewrap interfaces `() => [i1, i2]` -> `[()=>i1, ()=>i2]`
        // helps to solve hoisting problems
        TC.setInterfaces(convertInterfaceArrayAsThunk(interfaces, sc));
      }

      TC._gqcExtensions = (typeDef: any).extensions || {};
    } else {
      throw new Error(
        `You should provide GraphQLObjectTypeConfig or string with type name to ObjectTypeComposer.create(opts). Provided:\n${inspect(
          typeDef
        )}`
      );
    }

    return TC;
  }

  constructor(
    graphqlType: GraphQLObjectType,
    schemaComposer: SchemaComposer<TContext>
  ): ObjectTypeComposer<TSource, TContext> {
    if (!(schemaComposer instanceof SchemaComposer)) {
      throw new Error(
        'You must provide SchemaComposer instance as a second argument for `new ObjectTypeComposer(GraphQLObjectType, SchemaComposer)`'
      );
    }
    if (!(graphqlType instanceof GraphQLObjectType)) {
      throw new Error('ObjectTypeComposer accept only GraphQLObjectType in constructor');
    }

    this.schemaComposer = schemaComposer;
    this._gqType = graphqlType;

    // add itself to TypeStorage on create
    // it avoids recursive type use errors
    this.schemaComposer.set(graphqlType, this);

    if (graphqlVersion >= 14) {
      this._gqcFields = convertObjectFieldMapToConfig(this._gqType._fields, this.schemaComposer);
      this._gqcInterfaces = convertInterfaceArrayAsThunk(
        this._gqType._interfaces,
        this.schemaComposer
      );
    } else {
      const fields: Thunk<GraphQLFieldConfigMap<any, TContext>> = (this._gqType: any)._typeConfig
        .fields;
      this._gqcFields = this.schemaComposer.typeMapper.convertOutputFieldConfigMap(
        (resolveMaybeThunk(fields) || {}: any),
        this.getTypeName()
      );
      this._gqcInterfaces = convertInterfaceArrayAsThunk(
        this._gqType._interfaces || (this._gqType: any)._typeConfig.interfaces,
        this.schemaComposer
      );
    }

    // alive proper Flow type casting in autosuggestions for class with Generics
    /* :: return this; */
  }

  // -----------------------------------------------
  // Field methods
  // -----------------------------------------------

  getFields(): ObjectTypeComposerFieldConfigMap<TSource, TContext> {
    return this._gqcFields;
  }

  getFieldNames(): string[] {
    return Object.keys(this._gqcFields);
  }

  getField(fieldName: string): ObjectTypeComposerFieldConfig<TSource, TContext, ArgsMap> {
    const field = this._gqcFields[fieldName];
    if (!field) {
      throw new Error(
        `Cannot get field '${fieldName}' from type '${this.getTypeName()}'. Field does not exist.`
      );
    }
    return field;
  }

  hasField(fieldName: string): boolean {
    return !!this._gqcFields[fieldName];
  }

  setFields(
    fields: ObjectTypeComposerFieldConfigMapDefinition<TSource, TContext>
  ): ObjectTypeComposer<TSource, TContext> {
    this._gqcFields = this.schemaComposer.typeMapper.convertOutputFieldConfigMap(fields);
    return this;
  }

  setField(
    fieldName: string,
    fieldConfig: Thunk<
      | $ReadOnly<ComposeOutputType<TContext>>
      | ObjectTypeComposerFieldConfigDefinition<TSource, TContext, ArgsMap>
    >
  ): ObjectTypeComposer<TSource, TContext> {
    this._gqcFields[fieldName] = this.schemaComposer.typeMapper.convertOutputFieldConfig(
      fieldConfig
    );
    return this;
  }

  /**
   * Add new fields or replace existed in a GraphQL type
   */
  addFields(
    newFields: ObjectTypeComposerFieldConfigMapDefinition<TSource, TContext>
  ): ObjectTypeComposer<TSource, TContext> {
    this._gqcFields = {
      ...this._gqcFields,
      ...this.schemaComposer.typeMapper.convertOutputFieldConfigMap(newFields),
    };
    return this;
  }

  /**
   * Add new fields or replace existed (where field name may have dots)
   */
  addNestedFields(
    newFields: ObjectTypeComposerFieldConfigMapDefinition<TSource, TContext>
  ): ObjectTypeComposer<TSource, TContext> {
    Object.keys(newFields).forEach(fieldName => {
      const fc = newFields[fieldName];
      const names = fieldName.split('.');
      const name = names.shift();

      if (names.length === 0) {
        // single field
        this.setField(name, fc);
      } else {
        // nested field
        let childTC;
        if (!this.hasField(name)) {
          childTC = ObjectTypeComposer.create(
            `${this.getTypeName()}${upperFirst(name)}`,
            this.schemaComposer
          );
          this.setField(name, {
            type: childTC,
            resolve: () => ({}),
          });
        } else {
          childTC = this.getFieldTC(name);
        }
        if (childTC instanceof ObjectTypeComposer) {
          childTC.addNestedFields({ [names.join('.')]: fc });
        }
      }
    });

    return this;
  }

  removeField(fieldNameOrArray: string | string[]): ObjectTypeComposer<TSource, TContext> {
    const fieldNames = Array.isArray(fieldNameOrArray) ? fieldNameOrArray : [fieldNameOrArray];
    fieldNames.forEach(fieldName => delete this._gqcFields[fieldName]);
    return this;
  }

  removeOtherFields(fieldNameOrArray: string | string[]): ObjectTypeComposer<TSource, TContext> {
    const keepFieldNames = Array.isArray(fieldNameOrArray) ? fieldNameOrArray : [fieldNameOrArray];
    Object.keys(this._gqcFields).forEach(fieldName => {
      if (keepFieldNames.indexOf(fieldName) === -1) {
        delete this._gqcFields[fieldName];
      }
    });
    return this;
  }

  reorderFields(names: string[]): ObjectTypeComposer<TSource, TContext> {
    const orderedFields = {};
    const fields = this._gqcFields;
    names.forEach(name => {
      if (fields[name]) {
        orderedFields[name] = fields[name];
        delete fields[name];
      }
    });
    this._gqcFields = { ...orderedFields, ...fields };
    return this;
  }

  extendField(
    fieldName: string,
    partialFieldConfig: $Shape<
      ObjectTypeComposerFieldConfigAsObjectDefinition<TSource, TContext, ArgsMap>
    >
  ): ObjectTypeComposer<TSource, TContext> {
    let prevFieldConfig;
    try {
      prevFieldConfig = this.getField(fieldName);
    } catch (e) {
      throw new Error(
        `Cannot extend field '${fieldName}' from type '${this.getTypeName()}'. Field does not exist.`
      );
    }

    this.setField(fieldName, {
      ...prevFieldConfig,
      ...partialFieldConfig,
      extensions: {
        ...(prevFieldConfig.extensions || {}),
        ...(partialFieldConfig.extensions || {}),
      },
    });
    return this;
  }

  getFieldConfig(fieldName: string): GraphQLFieldConfig<TSource, TContext> {
    const { type, args, ...rest } = this.getField(fieldName);
    return ({
      type: type.getType(),
      args:
        args &&
        mapEachKey(args, ac => ({
          ...ac,
          type: ac.type.getType(),
        })),
      ...rest,
    }: any);
  }

  getFieldType(fieldName: string): GraphQLOutputType {
    return this.getField(fieldName).type.getType();
  }

  getFieldTypeName(fieldName: string): string {
    return this.getField(fieldName).type.getTypeName();
  }

  /**
   * Automatically unwrap from List, NonNull, ThunkComposer
   * It's important! Cause greatly helps to modify fields types in a real code
   * without manual unwrap writing.
   *
   * If you need to work with wrappers, you may use the following code:
   *   - `TC.getField().type` // returns real wrapped TypeComposer
   *   - `TC.isFieldNonNull()` // checks is field NonNull or not
   *   - `TC.makeFieldNonNull()` // for wrapping in NonNullComposer
   *   - `TC.makeFieldNullable()` // for unwrapping from NonNullComposer
   *   - `TC.isFieldPlural()` // checks is field wrapped in ListComposer or not
   *   - `TC.makeFieldPlural()` // for wrapping in ListComposer
   *   - `TC.makeFieldNonPlural()` // for unwrapping from ListComposer
   */
  getFieldTC(fieldName: string): ComposeNamedOutputType<TContext> {
    const anyTC = this.getField(fieldName).type;
    return unwrapOutputTC(anyTC);
  }

  /**
   * Alias for `getFieldTC()` but returns statically checked ObjectTypeComposer.
   * If field have other type then error will be thrown.
   */
  getFieldOTC(fieldName: string): ObjectTypeComposer<TSource, TContext> {
    const tc = this.getFieldTC(fieldName);
    if (!(tc instanceof ObjectTypeComposer)) {
      throw new Error(
        `${this.getTypeName()}.getFieldOTC('${fieldName}') must be ObjectTypeComposer, but recieved ${
          tc.constructor.name
        }. Maybe you need to use 'getFieldTC()' method which returns any type composer?`
      );
    }
    return tc;
  }

  isFieldNonNull(fieldName: string): boolean {
    return this.getField(fieldName).type instanceof NonNullComposer;
  }

  makeFieldNonNull(fieldNameOrArray: string | string[]): ObjectTypeComposer<TSource, TContext> {
    const fieldNames = Array.isArray(fieldNameOrArray) ? fieldNameOrArray : [fieldNameOrArray];
    fieldNames.forEach(fieldName => {
      const fc = this._gqcFields[fieldName];
      if (fc && !(fc.type instanceof NonNullComposer)) {
        fc.type = new NonNullComposer(fc.type);
      }
    });
    return this;
  }

  makeFieldNullable(fieldNameOrArray: string | string[]): ObjectTypeComposer<TSource, TContext> {
    const fieldNames = Array.isArray(fieldNameOrArray) ? fieldNameOrArray : [fieldNameOrArray];
    fieldNames.forEach(fieldName => {
      const fc = this._gqcFields[fieldName];
      if (fc && fc.type instanceof NonNullComposer) {
        fc.type = fc.type.ofType;
      }
    });
    return this;
  }

  isFieldPlural(fieldName: string): boolean {
    const type = this.getField(fieldName).type;
    return (
      type instanceof ListComposer ||
      (type instanceof NonNullComposer && type.ofType instanceof ListComposer)
    );
  }

  makeFieldPlural(fieldNameOrArray: string | string[]): ObjectTypeComposer<TSource, TContext> {
    const fieldNames = Array.isArray(fieldNameOrArray) ? fieldNameOrArray : [fieldNameOrArray];
    fieldNames.forEach(fieldName => {
      const fc = this._gqcFields[fieldName];
      if (fc && !(fc.type instanceof ListComposer)) {
        fc.type = new ListComposer(fc.type);
      }
    });
    return this;
  }

  makeFieldNonPlural(fieldNameOrArray: string | string[]): ObjectTypeComposer<TSource, TContext> {
    const fieldNames = Array.isArray(fieldNameOrArray) ? fieldNameOrArray : [fieldNameOrArray];
    fieldNames.forEach(fieldName => {
      const fc = this._gqcFields[fieldName];
      if (fc) {
        if (fc.type instanceof ListComposer) {
          fc.type = fc.type.ofType;
        } else if (fc.type instanceof NonNullComposer && fc.type.ofType instanceof ListComposer) {
          fc.type =
            fc.type.ofType.ofType instanceof NonNullComposer
              ? fc.type.ofType.ofType
              : new NonNullComposer(fc.type.ofType.ofType);
        }
      }
    });
    return this;
  }

  deprecateFields(
    fields: { [fieldName: string]: string } | string[] | string
  ): ObjectTypeComposer<TSource, TContext> {
    const existedFieldNames = this.getFieldNames();

    if (typeof fields === 'string') {
      if (existedFieldNames.indexOf(fields) === -1) {
        throw new Error(
          `Cannot deprecate unexisted field '${fields}' from type '${this.getTypeName()}'`
        );
      }
      this.extendField(fields, { deprecationReason: 'deprecated' });
    } else if (Array.isArray(fields)) {
      fields.forEach(field => {
        if (existedFieldNames.indexOf(field) === -1) {
          throw new Error(
            `Cannot deprecate unexisted field '${field}' from type '${this.getTypeName()}'`
          );
        }
        this.extendField(field, { deprecationReason: 'deprecated' });
      });
    } else {
      const fieldMap: Object = (fields: any);
      Object.keys(fieldMap).forEach(field => {
        if (existedFieldNames.indexOf(field) === -1) {
          throw new Error(
            `Cannot deprecate unexisted field '${field}' from type '${this.getTypeName()}'`
          );
        }
        const deprecationReason: string = fieldMap[field];
        this.extendField(field, { deprecationReason });
      });
    }

    return this;
  }

  /**
   * -----------------------------------------------
   * Field Args methods
   * -----------------------------------------------
   */

  getFieldArgs(fieldName: string): ObjectTypeComposerArgumentConfigMap<ArgsMap> {
    try {
      const fc = this.getField(fieldName);
      return fc.args || {};
    } catch (e) {
      throw new Error(
        `Cannot get args from '${this.getTypeName()}.${fieldName}'. Field does not exist.`
      );
    }
  }

  getFieldArgNames(fieldName: string): string[] {
    return Object.keys(this.getFieldArgs(fieldName));
  }

  hasFieldArg(fieldName: string, argName: string): boolean {
    try {
      const fieldArgs = this.getFieldArgs(fieldName);
      return !!fieldArgs[argName];
    } catch (e) {
      return false;
    }
  }

  getFieldArg(fieldName: string, argName: string): ObjectTypeComposerArgumentConfig {
    const fieldArgs = this.getFieldArgs(fieldName);
    const arg = fieldArgs[argName];
    if (!arg) {
      throw new Error(
        `Cannot get '${this.getTypeName()}.${fieldName}@${argName}'. Argument does not exist.`
      );
    }
    return arg;
  }

  getFieldArgType(fieldName: string, argName: string): GraphQLInputType {
    const ac = this.getFieldArg(fieldName, argName);
    return ac.type.getType();
  }

  getFieldArgTypeName(fieldName: string, argName: string): string {
    const ac = this.getFieldArg(fieldName, argName);
    return ac.type.getTypeName();
  }

  /**
   * Automatically unwrap from List, NonNull, ThunkComposer
   * It's important! Cause greatly helps to modify args types in a real code
   * without manual unwrap writing.
   *
   * If you need to work with wrappers, you may use the following code:
   *    `isFieldArgPlural()` – checks is arg wrapped in ListComposer or not
   *    `makeFieldArgPlural()` – for arg wrapping in ListComposer
   *    `makeFieldArgNonPlural()` – for arg unwrapping from ListComposer
   *    `isFieldArgNonNull()` – checks is arg wrapped in NonNullComposer or not
   *    `makeFieldArgNonNull()` – for arg wrapping in NonNullComposer
   *    `makeFieldArgNullable()` – for arg unwrapping from NonNullComposer
   */
  getFieldArgTC(fieldName: string, argName: string): ComposeNamedInputType<TContext> {
    const anyTC = this.getFieldArg(fieldName, argName).type;

    // Unwrap from List, NonNull and ThunkComposer
    return unwrapInputTC(anyTC);
  }

  /**
   * Alias for `getFieldArgTC()` but returns statically checked InputTypeComposer.
   * If field have other type then error will be thrown.
   */
  getFieldArgITC(fieldName: string, argName: string): InputTypeComposer<TContext> {
    const tc = this.getFieldArgTC(fieldName, argName);
    if (!(tc instanceof InputTypeComposer)) {
      throw new Error(
        `${this.getTypeName()}.getFieldArgITC('${fieldName}', '${argName}') must be InputTypeComposer, but recieved ${
          tc.constructor.name
        }. Maybe you need to use 'getFieldArgTC()' method which returns any type composer?`
      );
    }
    return tc;
  }

  setFieldArgs(
    fieldName: string,
    args: ObjectTypeComposerArgumentConfigMapDefinition<any>
  ): ObjectTypeComposer<TSource, TContext> {
    const fc = this.getField(fieldName);
    fc.args = this.schemaComposer.typeMapper.convertArgConfigMap(
      args,
      fieldName,
      this.getTypeName()
    );
    return this;
  }

  addFieldArgs(
    fieldName: string,
    newArgs: ObjectTypeComposerArgumentConfigMapDefinition<any>
  ): ObjectTypeComposer<TSource, TContext> {
    const fc = this.getField(fieldName);
    fc.args = {
      ...fc.args,
      ...this.schemaComposer.typeMapper.convertArgConfigMap(newArgs, fieldName, this.getTypeName()),
    };
    return this;
  }

  setFieldArg(
    fieldName: string,
    argName: string,
    argConfig: ObjectTypeComposerArgumentConfigDefinition
  ): ObjectTypeComposer<TSource, TContext> {
    const fc = this.getField(fieldName);
    fc.args = fc.args || {};
    (fc.args: any)[argName] = this.schemaComposer.typeMapper.convertArgConfig(
      argConfig,
      argName,
      fieldName,
      this.getTypeName()
    );
    return this;
  }

  removeFieldArg(
    fieldName: string,
    argNameOrArray: string | string[]
  ): ObjectTypeComposer<TSource, TContext> {
    const argNames = Array.isArray(argNameOrArray) ? argNameOrArray : [argNameOrArray];
    const args = this._gqcFields[fieldName] && this._gqcFields[fieldName].args;
    if (args) {
      argNames.forEach(argName => delete args[argName]);
    }
    return this;
  }

  removeFieldOtherArgs(
    fieldName: string,
    argNameOrArray: string | string[]
  ): ObjectTypeComposer<TSource, TContext> {
    const keepArgNames = Array.isArray(argNameOrArray) ? argNameOrArray : [argNameOrArray];
    const args = this._gqcFields[fieldName] && this._gqcFields[fieldName].args;
    if (args) {
      Object.keys(args).forEach(argName => {
        if (keepArgNames.indexOf(argName) === -1) {
          delete args[argName];
        }
      });
    }
    return this;
  }

  isFieldArgPlural(fieldName: string, argName: string): boolean {
    const type = this.getFieldArg(fieldName, argName).type;
    return (
      type instanceof ListComposer ||
      (type instanceof NonNullComposer && type.ofType instanceof ListComposer)
    );
  }

  makeFieldArgPlural(
    fieldName: string,
    argNameOrArray: string | string[]
  ): ObjectTypeComposer<TSource, TContext> {
    const args = this.getField(fieldName).args;
    if (!args) return this;
    const argNames = Array.isArray(argNameOrArray) ? argNameOrArray : [argNameOrArray];
    argNames.forEach(argName => {
      const ac = args[argName];
      if (ac && !(ac.type instanceof ListComposer)) {
        ac.type = new ListComposer(ac.type);
      }
    });
    return this;
  }

  makeFieldArgNonPlural(
    fieldName: string,
    argNameOrArray: string | string[]
  ): ObjectTypeComposer<TSource, TContext> {
    const args = this.getField(fieldName).args;
    if (!args) return this;
    const argNames = Array.isArray(argNameOrArray) ? argNameOrArray : [argNameOrArray];
    argNames.forEach(argName => {
      const ac = args[argName];
      if (ac) {
        if (ac.type instanceof ListComposer) {
          ac.type = ac.type.ofType;
        } else if (ac.type instanceof NonNullComposer && ac.type.ofType instanceof ListComposer) {
          ac.type =
            ac.type.ofType.ofType instanceof NonNullComposer
              ? ac.type.ofType.ofType
              : new NonNullComposer(ac.type.ofType.ofType);
        }
      }
    });
    return this;
  }

  isFieldArgNonNull(fieldName: string, argName: string): boolean {
    const type = this.getFieldArg(fieldName, argName).type;
    return type instanceof NonNullComposer;
  }

  makeFieldArgNonNull(
    fieldName: string,
    argNameOrArray: string | string[]
  ): ObjectTypeComposer<TSource, TContext> {
    const args = this.getField(fieldName).args;
    if (!args) return this;
    const argNames = Array.isArray(argNameOrArray) ? argNameOrArray : [argNameOrArray];
    argNames.forEach(argName => {
      const ac = args[argName];
      if (ac && !(ac.type instanceof NonNullComposer)) {
        ac.type = new NonNullComposer(ac.type);
      }
    });
    return this;
  }

  makeFieldArgNullable(
    fieldName: string,
    argNameOrArray: string | string[]
  ): ObjectTypeComposer<TSource, TContext> {
    const args = this.getField(fieldName).args;
    if (!args) return this;
    const argNames = Array.isArray(argNameOrArray) ? argNameOrArray : [argNameOrArray];
    argNames.forEach(argName => {
      const ac = args[argName];
      if (ac && ac.type instanceof NonNullComposer) {
        ac.type = ac.type.ofType;
      }
    });
    return this;
  }

  // -----------------------------------------------
  // Type methods
  // -----------------------------------------------

  getType(): GraphQLObjectType {
    if (graphqlVersion >= 14) {
      this._gqType._fields = () =>
        defineFieldMap(
          this._gqType,
          mapEachKey(this._gqcFields, (fc, name) => this.getFieldConfig(name))
        );
      this._gqType._interfaces = () => this._gqcInterfaces.map(i => i.getType());
    } else {
      (this._gqType: any)._typeConfig.fields = () => {
        return mapEachKey(this._gqcFields, (fc, name) => this.getFieldConfig(name));
      };
      (this._gqType: any)._typeConfig.interfaces = () => this._gqcInterfaces.map(i => i.getType());
      delete this._gqType._fields; // clear builded fields in type
      delete this._gqType._interfaces;
    }
    return this._gqType;
  }

  getTypePlural(): ListComposer<ObjectTypeComposer<TSource, TContext>> {
    return new ListComposer(this);
  }

  getTypeNonNull(): NonNullComposer<ObjectTypeComposer<TSource, TContext>> {
    return new NonNullComposer(this);
  }

  getTypeName(): string {
    return this._gqType.name;
  }

  setTypeName(name: string): ObjectTypeComposer<TSource, TContext> {
    this._gqType.name = name;
    this.schemaComposer.add(this);
    return this;
  }

  getDescription(): string {
    return this._gqType.description || '';
  }

  setDescription(description: string): ObjectTypeComposer<TSource, TContext> {
    this._gqType.description = description;
    return this;
  }

  /**
   * You may clone this type with a new provided name as string.
   * Or you may provide a new TypeComposer which will get all clonned
   * settings from this type.
   */
  clone(
    newTypeNameOrTC: string | ObjectTypeComposer<any, any>
  ): ObjectTypeComposer<TSource, TContext> {
    if (!newTypeNameOrTC) {
      throw new Error('You should provide newTypeName:string for ObjectTypeComposer.clone()');
    }

    const cloned =
      newTypeNameOrTC instanceof ObjectTypeComposer
        ? newTypeNameOrTC
        : ObjectTypeComposer.create(newTypeNameOrTC, this.schemaComposer);

    cloned._gqcFields = mapEachKey(this._gqcFields, fieldConfig => ({
      ...fieldConfig,
      args: mapEachKey(fieldConfig.args, argConfig => ({
        ...argConfig,
        extensions: { ...argConfig.extensions },
      })),
      extensions: { ...fieldConfig.extensions },
    }));
    cloned._gqcInterfaces = [...this._gqcInterfaces];
    cloned._gqcExtensions = { ...this._gqcExtensions };
    cloned._gqcGetRecordIdFn = this._gqcGetRecordIdFn;
    cloned.setDescription(this.getDescription());

    this.getResolvers().forEach(resolver => {
      const newResolver = resolver.clone();
      cloned.addResolver(newResolver);
    });

    return cloned;
  }

  getIsTypeOf(): ?GraphQLIsTypeOfFn<TSource, TContext> {
    return this._gqType.isTypeOf;
  }

  setIsTypeOf(fn: ?GraphQLIsTypeOfFn<any, any>): ObjectTypeComposer<TSource, TContext> {
    this._gqType.isTypeOf = fn;
    return this;
  }

  merge(
    type:
      | GraphQLObjectType
      | GraphQLInterfaceType
      | ObjectTypeComposer<any, any>
      | InterfaceTypeComposer<any, any>
  ): ObjectTypeComposer<TSource, TContext> {
    if (type instanceof GraphQLObjectType) {
      const tmp = ObjectTypeComposer.createTemp(type, this.schemaComposer);
      this.addFields(tmp.getFields());
      this.addInterfaces(tmp.getInterfaces());
    } else if (type instanceof GraphQLInterfaceType) {
      const tmp = InterfaceTypeComposer.createTemp(type, this.schemaComposer);
      this.addFields(tmp.getFields());
    } else if (type instanceof ObjectTypeComposer) {
      this.addFields(type.getFields());
      this.addInterfaces(type.getInterfaces());
      // Feel free to add other properties for merging two TypeComposers.
      // For simplicity it just merge fields and interfaces.
    } else if (type instanceof InterfaceTypeComposer) {
      this.addFields(type.getFields());
    } else {
      throw new Error(
        `Cannot merge ${inspect(
          type
        )} with ObjectType(${this.getTypeName()}). Provided type should be GraphQLObjectType or ObjectTypeComposer.`
      );
    }

    return this;
  }

  // -----------------------------------------------
  // InputType methods
  // -----------------------------------------------

  getInputType(): GraphQLInputObjectType {
    return this.getInputTypeComposer().getType();
  }

  hasInputTypeComposer(): boolean {
    return !!this._gqcInputTypeComposer;
  }

  setInputTypeComposer(itc: InputTypeComposer<TContext>): ObjectTypeComposer<TSource, TContext> {
    this._gqcInputTypeComposer = itc;
    return this;
  }

  getInputTypeComposer(): InputTypeComposer<TContext> {
    if (!this._gqcInputTypeComposer) {
      this._gqcInputTypeComposer = toInputObjectType(this);
    }

    return this._gqcInputTypeComposer;
  }

  // Alias for getInputTypeComposer()
  getITC(): InputTypeComposer<TContext> {
    return this.getInputTypeComposer();
  }

  removeInputTypeComposer(): ObjectTypeComposer<TSource, TContext> {
    this._gqcInputTypeComposer = undefined;
    return this;
  }

  // -----------------------------------------------
  // Resolver methods
  // -----------------------------------------------

  getResolvers(): Map<string, Resolver<any, TContext, any>> {
    if (!this._gqcResolvers) {
      this._gqcResolvers = new Map();
    }
    return this._gqcResolvers;
  }

  hasResolver(name: string): boolean {
    if (!this._gqcResolvers) {
      return false;
    }
    return this._gqcResolvers.has(name);
  }

  getResolver(
    name: string,
    middlewares?: Array<ResolverMiddleware<TSource, TContext, ArgsMap>>
  ): Resolver<any, TContext, ArgsMap> {
    if (!this.hasResolver(name)) {
      throw new Error(`Type ${this.getTypeName()} does not have resolver with name '${name}'`);
    }
    const resolverMap: any = this._gqcResolvers;
    const resolver = resolverMap.get(name);

    if (Array.isArray(middlewares)) {
      return resolver.withMiddlewares(middlewares);
    }

    return resolver;
  }

  setResolver(
    name: string,
    resolver: Resolver<any, TContext, ArgsMap>
  ): ObjectTypeComposer<TSource, TContext> {
    if (!this._gqcResolvers) {
      this._gqcResolvers = new Map();
    }
    if (!(resolver instanceof Resolver)) {
      throw new Error('setResolver() accept only Resolver instance');
    }
    this._gqcResolvers.set(name, resolver);
    resolver.setDisplayName(`${this.getTypeName()}.${resolver.name}`);
    return this;
  }

  addResolver(
    opts: Resolver<any, TContext, ArgsMap> | ResolverDefinition<any, TContext, ArgsMap>
  ): ObjectTypeComposer<TSource, TContext> {
    if (!opts) {
      throw new Error('addResolver called with empty Resolver');
    }

    let resolver: Resolver<any, TContext, any>;
    if (!(opts instanceof Resolver)) {
      const resolverOpts = { ...opts };
      // add resolve method, otherwise added resolver will not return any data by graphql-js
      if (!resolverOpts.hasOwnProperty('resolve')) {
        resolverOpts.resolve = () => ({});
      }
      resolver = new Resolver(
        (resolverOpts: ResolverDefinition<any, TContext, any>),
        this.schemaComposer
      );
    } else {
      resolver = opts;
    }

    if (!resolver.name) {
      throw new Error('resolver should have non-empty `name` property');
    }
    this.setResolver(resolver.name, resolver);
    return this;
  }

  removeResolver(resolverName: string): ObjectTypeComposer<TSource, TContext> {
    if (resolverName) {
      this.getResolvers().delete(resolverName);
    }
    return this;
  }

  wrapResolver(
    resolverName: string,
    cbResolver: ResolverWrapCb<any, TSource, TContext, ArgsMap, ArgsMap>
  ): ObjectTypeComposer<TSource, TContext> {
    const resolver = this.getResolver(resolverName);
    const newResolver = resolver.wrap(cbResolver);
    this.setResolver(resolverName, newResolver);
    return this;
  }

  wrapResolverAs(
    resolverName: string,
    fromResolverName: string,
    cbResolver: ResolverWrapCb<any, TSource, TContext, ArgsMap, ArgsMap>
  ): ObjectTypeComposer<TSource, TContext> {
    const resolver = this.getResolver(fromResolverName);
    const newResolver = resolver.wrap(cbResolver);
    this.setResolver(resolverName, newResolver);
    return this;
  }

  wrapResolverResolve(
    resolverName: string,
    cbNextRp: ResolverNextRpCb<any, TContext, ArgsMap>
  ): ObjectTypeComposer<TSource, TContext> {
    const resolver = this.getResolver(resolverName);
    this.setResolver(resolverName, resolver.wrapResolve(cbNextRp));
    return this;
  }

  // -----------------------------------------------
  // Interface methods
  // -----------------------------------------------

  getInterfaces(): Array<InterfaceTypeComposerThunked<TSource, TContext>> {
    return this._gqcInterfaces;
  }

  setInterfaces(
    interfaces: $ReadOnlyArray<InterfaceTypeComposerDefinition<any, TContext>>
  ): ObjectTypeComposer<TSource, TContext> {
    this._gqcInterfaces = convertInterfaceArrayAsThunk(interfaces, this.schemaComposer);
    return this;
  }

  hasInterface(iface: InterfaceTypeComposerDefinition<any, TContext>): boolean {
    const typeName = getComposeTypeName(iface);
    return !!this._gqcInterfaces.find(i => i.getTypeName() === typeName);
  }

  addInterface(
    iface:
      | InterfaceTypeComposerDefinition<any, TContext>
      | InterfaceTypeComposerThunked<any, TContext>
  ): ObjectTypeComposer<TSource, TContext> {
    if (!this.hasInterface(iface)) {
      this._gqcInterfaces.push(
        this.schemaComposer.typeMapper.convertInterfaceTypeDefinition(iface)
      );
    }
    return this;
  }

  addInterfaces(
    ifaces: $ReadOnlyArray<
      InterfaceTypeComposerDefinition<any, TContext> | InterfaceTypeComposerThunked<any, TContext>
    >
  ): ObjectTypeComposer<TSource, TContext> {
    if (!Array.isArray(ifaces)) {
      throw new Error(
        `ObjectTypeComposer[${this.getTypeName()}].addInterfaces() accepts only array`
      );
    }
    ifaces.forEach(iface => this.addInterface(iface));
    return this;
  }

  removeInterface(
    iface: InterfaceTypeComposerDefinition<any, TContext>
  ): ObjectTypeComposer<TSource, TContext> {
    const typeName = getComposeTypeName(iface);
    this._gqcInterfaces = this._gqcInterfaces.filter(i => i.getTypeName() !== typeName);
    return this;
  }

  // -----------------------------------------------
  // Extensions methods
  // -----------------------------------------------

  getExtensions(): Extensions {
    if (!this._gqcExtensions) {
      return {};
    } else {
      return this._gqcExtensions;
    }
  }

  setExtensions(extensions: Extensions): ObjectTypeComposer<TSource, TContext> {
    this._gqcExtensions = extensions;
    return this;
  }

  extendExtensions(extensions: Extensions): ObjectTypeComposer<TSource, TContext> {
    const current = this.getExtensions();
    this.setExtensions({
      ...current,
      ...extensions,
    });
    return this;
  }

  clearExtensions(): ObjectTypeComposer<TSource, TContext> {
    this.setExtensions({});
    return this;
  }

  getExtension(extensionName: string): ?any {
    const extensions = this.getExtensions();
    return extensions[extensionName];
  }

  hasExtension(extensionName: string): boolean {
    const extensions = this.getExtensions();
    return extensionName in extensions;
  }

  setExtension(extensionName: string, value: any): ObjectTypeComposer<TSource, TContext> {
    this.extendExtensions({
      [extensionName]: value,
    });
    return this;
  }

  removeExtension(extensionName: string): ObjectTypeComposer<TSource, TContext> {
    const extensions = { ...this.getExtensions() };
    delete extensions[extensionName];
    this.setExtensions(extensions);
    return this;
  }

  getFieldExtensions(fieldName: string): Extensions {
    const field = this.getField(fieldName);
    return field.extensions || {};
  }

  setFieldExtensions(
    fieldName: string,
    extensions: Extensions
  ): ObjectTypeComposer<TSource, TContext> {
    const field = this.getField(fieldName);
    this.setField(fieldName, { ...field, extensions });
    return this;
  }

  extendFieldExtensions(
    fieldName: string,
    extensions: Extensions
  ): ObjectTypeComposer<TSource, TContext> {
    const current = this.getFieldExtensions(fieldName);
    this.setFieldExtensions(fieldName, {
      ...current,
      ...extensions,
    });
    return this;
  }

  clearFieldExtensions(fieldName: string): ObjectTypeComposer<TSource, TContext> {
    this.setFieldExtensions(fieldName, {});
    return this;
  }

  getFieldExtension(fieldName: string, extensionName: string): ?any {
    const extensions = this.getFieldExtensions(fieldName);
    return extensions[extensionName];
  }

  hasFieldExtension(fieldName: string, extensionName: string): boolean {
    const extensions = this.getFieldExtensions(fieldName);
    return extensionName in extensions;
  }

  setFieldExtension(
    fieldName: string,
    extensionName: string,
    value: any
  ): ObjectTypeComposer<TSource, TContext> {
    this.extendFieldExtensions(fieldName, {
      [extensionName]: value,
    });
    return this;
  }

  removeFieldExtension(
    fieldName: string,
    extensionName: string
  ): ObjectTypeComposer<TSource, TContext> {
    const extensions = { ...this.getFieldExtensions(fieldName) };
    delete extensions[extensionName];
    this.setFieldExtensions(fieldName, extensions);
    return this;
  }

  getFieldArgExtensions(fieldName: string, argName: string): Extensions {
    const ac = this.getFieldArg(fieldName, argName);
    return ac.extensions || {};
  }

  setFieldArgExtensions(
    fieldName: string,
    argName: string,
    extensions: Extensions
  ): ObjectTypeComposer<TSource, TContext> {
    const ac = this.getFieldArg(fieldName, argName);
    this.setFieldArg(fieldName, argName, { ...ac, extensions });
    return this;
  }

  extendFieldArgExtensions(
    fieldName: string,
    argName: string,
    extensions: Extensions
  ): ObjectTypeComposer<TSource, TContext> {
    const current = this.getFieldArgExtensions(fieldName, argName);
    this.setFieldArgExtensions(fieldName, argName, {
      ...current,
      ...extensions,
    });
    return this;
  }

  clearFieldArgExtensions(
    fieldName: string,
    argName: string
  ): ObjectTypeComposer<TSource, TContext> {
    this.setFieldArgExtensions(fieldName, argName, {});
    return this;
  }

  getFieldArgExtension(fieldName: string, argName: string, extensionName: string): ?any {
    const extensions = this.getFieldArgExtensions(fieldName, argName);
    return extensions[extensionName];
  }

  hasFieldArgExtension(fieldName: string, argName: string, extensionName: string): boolean {
    const extensions = this.getFieldArgExtensions(fieldName, argName);
    return extensionName in extensions;
  }

  setFieldArgExtension(
    fieldName: string,
    argName: string,
    extensionName: string,
    value: any
  ): ObjectTypeComposer<TSource, TContext> {
    this.extendFieldArgExtensions(fieldName, argName, {
      [extensionName]: value,
    });
    return this;
  }

  removeFieldArgExtension(
    fieldName: string,
    argName: string,
    extensionName: string
  ): ObjectTypeComposer<TSource, TContext> {
    const extensions = { ...this.getFieldArgExtensions(fieldName, argName) };
    delete extensions[extensionName];
    this.setFieldArgExtensions(fieldName, argName, extensions);
    return this;
  }

  // -----------------------------------------------
  // Directive methods
  // -----------------------------------------------

  getDirectives(): Array<ExtensionsDirective> {
    const directives = this.getExtension('directives');
    if (Array.isArray(directives)) {
      return directives;
    }
    return [];
  }

  getDirectiveNames(): string[] {
    return this.getDirectives().map(d => d.name);
  }

  getDirectiveByName(directiveName: string): ?DirectiveArgs {
    const directive = this.getDirectives().find(d => d.name === directiveName);
    if (!directive) return undefined;
    return directive.args;
  }

  getDirectiveById(idx: number): ?DirectiveArgs {
    const directive = this.getDirectives()[idx];
    if (!directive) return undefined;
    return directive.args;
  }

  getFieldDirectives(fieldName: string): Array<ExtensionsDirective> {
    const directives = this.getFieldExtension(fieldName, 'directives');
    if (Array.isArray(directives)) {
      return directives;
    }
    return [];
  }

  getFieldDirectiveNames(fieldName: string): string[] {
    return this.getFieldDirectives(fieldName).map(d => d.name);
  }

  getFieldDirectiveByName(fieldName: string, directiveName: string): ?DirectiveArgs {
    const directive = this.getFieldDirectives(fieldName).find(d => d.name === directiveName);
    if (!directive) return undefined;
    return directive.args;
  }

  getFieldDirectiveById(fieldName: string, idx: number): ?DirectiveArgs {
    const directive = this.getFieldDirectives(fieldName)[idx];
    if (!directive) return undefined;
    return directive.args;
  }

  getFieldArgDirectives(fieldName: string, argName: string): Array<ExtensionsDirective> {
    const directives = this.getFieldArgExtension(fieldName, argName, 'directives');
    if (Array.isArray(directives)) {
      return directives;
    }
    return [];
  }

  getFieldArgDirectiveNames(fieldName: string, argName: string): string[] {
    return this.getFieldArgDirectives(fieldName, argName).map(d => d.name);
  }

  getFieldArgDirectiveByName(
    fieldName: string,
    argName: string,
    directiveName: string
  ): ?DirectiveArgs {
    const directive = this.getFieldArgDirectives(fieldName, argName).find(
      d => d.name === directiveName
    );
    if (!directive) return undefined;
    return directive.args;
  }

  getFieldArgDirectiveById(fieldName: string, argName: string, idx: number): ?DirectiveArgs {
    const directive = this.getFieldArgDirectives(fieldName, argName)[idx];
    if (!directive) return undefined;
    return directive.args;
  }

  // -----------------------------------------------
  // Misc methods
  // -----------------------------------------------

  addRelation(
    fieldName: string,
    opts: $ReadOnly<ObjectTypeComposerRelationOpts<any, TSource, TContext, ArgsMap>>
  ): ObjectTypeComposer<TSource, TContext> {
    if (!this._gqcRelations) {
      this._gqcRelations = {};
    }
    this._gqcRelations[fieldName] = opts;

    if (opts.hasOwnProperty('resolver')) {
      if (isFunction(opts.resolver)) {
        this._gqcFields[fieldName] = createThunkedObjectProxy(() =>
          this._relationWithResolverToFC(opts, fieldName)
        );
      } else {
        this._gqcFields[fieldName] = this._relationWithResolverToFC(opts, fieldName);
      }
    } else if (opts.hasOwnProperty('type')) {
      const fc: ObjectTypeComposerFieldConfigAsObjectDefinition<
        TSource,
        TContext,
        any
      > = (opts: any);
      this.setField(fieldName, fc);
    }

    return this;
  }

  getRelations(): ObjectTypeComposerRelationThunkMap<any, TContext> {
    if (!this._gqcRelations) {
      this._gqcRelations = {};
    }
    return this._gqcRelations;
  }

  _relationWithResolverToFC(
    opts: ObjectTypeComposerRelationOptsWithResolver<any, TSource, TContext, any>,
    fieldName?: string = ''
  ): ObjectTypeComposerFieldConfig<TSource, TContext, any> {
    const resolver = isFunction(opts.resolver) ? opts.resolver() : opts.resolver;

    if (!(resolver instanceof Resolver)) {
      throw new Error(
        'You should provide correct Resolver object for relation ' +
          `${this.getTypeName()}.${fieldName}`
      );
    }
    if ((opts: any).type) {
      throw new Error(
        'You can not use `resolver` and `type` properties simultaneously for relation ' +
          `${this.getTypeName()}.${fieldName}`
      );
    }
    if ((opts: any).resolve) {
      throw new Error(
        'You can not use `resolver` and `resolve` properties simultaneously for relation ' +
          `${this.getTypeName()}.${fieldName}`
      );
    }

    const argsConfig = { ...resolver.args };
    const argsProto = {};
    const argsRuntime: [
      string,
      ObjectTypeComposerRelationArgsMapperFn<TSource, TContext, ArgsMap>
    ][] = [];

    // remove args from config, if arg name provided in args
    //    if `argMapVal`
    //       is `undefined`, then keep arg field in config
    //       is `null`, then just remove arg field from config
    //       is `function`, then remove arg field and run it in resolve
    //       is any other value, then put it to args prototype for resolve
    const optsArgs = opts.prepareArgs || {};

    Object.keys(optsArgs).forEach(argName => {
      const argMapVal = optsArgs[argName];
      if (argMapVal !== undefined) {
        delete argsConfig[argName];

        if (isFunction(argMapVal)) {
          argsRuntime.push([argName, argMapVal]);
        } else if (argMapVal !== null) {
          argsProto[argName] = argMapVal;
        }
      }
    });

    // if opts.catchErrors is undefined then set true, otherwise take it value
    const { catchErrors = true } = opts;

    const fieldConfig = resolver.getFieldConfig();
    const resolve = (source, args, context, info) => {
      const newArgs = { ...args, ...argsProto };
      argsRuntime.forEach(([argName, argFn]) => {
        newArgs[argName] = argFn(source, args, context, info);
      });

      const payload = fieldConfig.resolve
        ? fieldConfig.resolve(source, newArgs, context, info)
        : null;
      return catchErrors
        ? Promise.resolve(payload).catch(e => {
            // eslint-disable-next-line
            console.log(`GQC ERROR: relation for ${this.getTypeName()}.${fieldName} throws error:`);
            console.log(e); // eslint-disable-line
            return null;
          })
        : payload;
    };

    return {
      type: resolver.type,
      description: opts.description || resolver.description,
      deprecationReason: opts.deprecationReason,
      args: argsConfig,
      resolve,
      projection: opts.projection,
    };
  }

  setRecordIdFn(
    fn: ObjectTypeComposerGetRecordIdFn<TSource, TContext>
  ): ObjectTypeComposer<TSource, TContext> {
    this._gqcGetRecordIdFn = fn;
    return this;
  }

  hasRecordIdFn(): boolean {
    return !!this._gqcGetRecordIdFn;
  }

  getRecordIdFn(): ObjectTypeComposerGetRecordIdFn<TSource, TContext> {
    if (!this._gqcGetRecordIdFn) {
      throw new Error(`Type ${this.getTypeName()} does not have RecordIdFn`);
    }
    return this._gqcGetRecordIdFn;
  }

  /**
   * Get function that returns record id, from provided object.
   */
  getRecordId(source: TSource, args?: ArgsMap, context?: TContext): string | number {
    return this.getRecordIdFn()(source, args, context);
  }

  get(path: string | string[]): TypeInPath<TContext> | void {
    return typeByPath(this, path);
  }
}
