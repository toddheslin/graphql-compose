import {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLOutputType,
  GraphQLInputType,
  GraphQLIsTypeOfFn,
  GraphQLResolveInfo,
  GraphQLFieldResolver,
  FieldDefinitionNode,
  InputValueDefinitionNode,
} from 'graphql';
import {
  Resolver,
  ResolverNextRpCb,
  ResolverDefinition,
  ResolverWrapCb,
  ResolverMiddleware,
} from './Resolver';
import { SchemaComposer } from './SchemaComposer';
import {
  ObjMap,
  Thunk,
  Extensions,
  ExtensionsDirective,
  DirectiveArgs,
  ObjMapReadOnly,
} from './utils/definitions';
import { ProjectionType } from './utils/projection';
import { TypeDefinitionString, TypeAsString } from './TypeMapper';
import {
  InterfaceTypeComposerDefinition,
  InterfaceTypeComposerThunked,
  InterfaceTypeComposer,
} from './InterfaceTypeComposer';
import {
  ComposeOutputTypeDefinition,
  ComposeOutputType,
  ComposeInputTypeDefinition,
  ComposeInputType,
  ComposeNamedOutputType,
  ComposeNamedInputType,
} from './utils/typeHelpers';
import { ThunkComposer } from './ThunkComposer';
import { InputTypeComposer } from './InputTypeComposer';
import { NonNullComposer } from './NonNullComposer';
import { ListComposer } from './ListComposer';
import { TypeInPath } from './utils/typeByPath';

export type ObjectTypeComposerDefinition<TSource, TContext> =
  | TypeAsString
  | TypeDefinitionString
  | ObjectTypeComposerAsObjectDefinition<TSource, TContext>
  | Readonly<ObjectTypeComposer<TSource, TContext>>
  | Readonly<GraphQLObjectType>;

export type ObjectTypeComposerAsObjectDefinition<TSource, TContext> = {
  name: string;
  interfaces?: null | Thunk<ReadonlyArray<InterfaceTypeComposerDefinition<any, TContext>>>;
  fields?: ObjectTypeComposerFieldConfigMapDefinition<TSource, TContext>;
  isTypeOf?: null | GraphQLIsTypeOfFn<TSource, TContext>;
  description?: string | null;
  isIntrospection?: boolean;
  extensions?: Extensions;
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
  | Readonly<Resolver<any, TContext, any>>
  | Readonly<ComposeOutputType<TContext>>;

export type ObjectTypeComposerFieldConfigAsObjectDefinition<TSource, TContext, TArgs = ArgsMap> = {
  type: Thunk<ComposeOutputTypeDefinition<TContext> | Readonly<Resolver<any, TContext, any>>>;
  args?: ObjectTypeComposerArgumentConfigMapDefinition<TArgs>;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  subscribe?: GraphQLFieldResolver<TSource, TContext>;
  deprecationReason?: string | null;
  description?: string | null;
  extensions?: Extensions;
  [key: string]: any;
};

export type ObjectTypeComposerFieldConfig<TSource, TContext, TArgs = ArgsMap> = {
  type: ComposeOutputType<TContext>;
  args?: ObjectTypeComposerArgumentConfigMap<TArgs>;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  subscribe?: GraphQLFieldResolver<TSource, TContext>;
  deprecationReason?: string | null;
  description?: string | null;
  astNode?: FieldDefinitionNode | null;
  extensions?: Extensions;
  [key: string]: any;
};

// Compose Args -----------------------------

export type ArgsMap = { [argName: string]: any };

export type ObjectTypeComposerArgumentConfigMap<TArgs = ArgsMap> = {
  [argName in keyof TArgs]: ObjectTypeComposerArgumentConfig;
};

export type ObjectTypeComposerArgumentConfigMapDefinition<TArgs = ArgsMap> = {
  [argName in keyof TArgs]: Thunk<ObjectTypeComposerArgumentConfigDefinition>;
};

export type ObjectTypeComposerArgumentConfigAsObjectDefinition = {
  type: Thunk<ComposeInputTypeDefinition>;
  defaultValue?: any;
  description?: string | null;
  extensions?: Extensions;
  [key: string]: any;
};

export type ObjectTypeComposerArgumentConfig = {
  type: ComposeInputType;
  defaultValue?: any;
  description?: string | null;
  astNode?: InputValueDefinitionNode | null;
  extensions?: Extensions;
  [key: string]: any;
};

export type ObjectTypeComposerArgumentConfigDefinition =
  | ObjectTypeComposerArgumentConfigAsObjectDefinition
  | ComposeInputTypeDefinition;

// RELATION -----------------------------

export type ObjectTypeComposerRelationThunkMap<TSource, TContext> = {
  [fieldName: string]: Thunk<ObjectTypeComposerRelationOpts<any, TSource, TContext, ArgsMap>>;
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
  resolver: Thunk<Resolver<TRelationSource, TContext, TArgs>>;
  prepareArgs?: ObjectTypeComposerRelationArgsMapper<TSource, TContext, TArgs>;
  projection?: ProjectionType;
  description?: string | null;
  deprecationReason?: string | null;
  catchErrors?: boolean;
};

export type ObjectTypeComposerRelationArgsMapperFn<TSource, TContext, TArgs = ArgsMap> = (
  source: TSource,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => any;
export type ObjectTypeComposerRelationArgsMapper<TSource, TContext, TArgs = ArgsMap> = {
  [argName: string]:
    | { [key: string]: any }
    | ObjectTypeComposerRelationArgsMapperFn<TSource, TContext, TArgs>
    | null
    | void
    | string
    | number
    | any[];
};

export type ObjectTypeComposerGetRecordIdFn<TSource, TContext> = (
  source: TSource,
  args?: ArgsMap,
  context?: TContext
) => string;

export type ObjectTypeComposerThunked<TReturn, TContext> =
  | ObjectTypeComposer<TReturn, TContext>
  | ThunkComposer<ObjectTypeComposer<TReturn, TContext>, GraphQLObjectType>;

/**
 * Main class that gets `GraphQLObjectType` and provide ability to change them.
 */
export class ObjectTypeComposer<TSource = any, TContext = any> {
  public schemaComposer: SchemaComposer<TContext>;
  protected _gqType: GraphQLObjectType;
  protected _gqcInputTypeComposer: void | InputTypeComposer<TContext>;
  protected _gqcResolvers: void | Map<string, Resolver<TSource, TContext>>;
  protected _gqcGetRecordIdFn: void | ObjectTypeComposerGetRecordIdFn<TSource, TContext>;
  protected _gqcRelations: void | ObjectTypeComposerRelationThunkMap<TSource, TContext>;
  protected _gqcFields: ObjectTypeComposerFieldConfigMap<TSource, TContext>;
  protected _gqcInterfaces: Array<InterfaceTypeComposerThunked<TSource, TContext>>;
  protected _gqcExtensions: void | Extensions;

  /**
   * Create `ObjectTypeComposer` with adding it by name to the `SchemaComposer`.
   */
  public static create<TSrc = any, TCtx = any>(
    typeDef: ObjectTypeComposerDefinition<TSrc, TCtx>,
    schemaComposer: SchemaComposer<TCtx>
  ): ObjectTypeComposer<TSrc, TCtx>;

  /**
   * Create `ObjectTypeComposer` without adding it to the `SchemaComposer`. This method may be usefull in plugins, when you need to create type temporary.
   */
  public static createTemp<TSrc = any, TCtx = any>(
    typeDef: ObjectTypeComposerDefinition<TSrc, TCtx>,
    schemaComposer?: SchemaComposer<TCtx>
  ): ObjectTypeComposer<TSrc, TCtx>;

  public constructor(graphqlType: GraphQLObjectType, schemaComposer: SchemaComposer<TContext>);

  /**
   * -----------------------------------------------
   * Field methods
   * -----------------------------------------------
   */

  public getFields(): ObjectTypeComposerFieldConfigMap<TSource, TContext>;

  public getFieldNames(): string[];

  public getField<TArgs = ArgsMap>(
    fieldName: string
  ): ObjectTypeComposerFieldConfig<TSource, TContext, TArgs>;

  public hasField(fieldName: string): boolean;

  public setFields(fields: ObjectTypeComposerFieldConfigMapDefinition<TSource, TContext>): this;

  public setField<TArgs = ArgsMap>(
    fieldName: string,
    fieldConfig: Thunk<
      | Readonly<ComposeOutputType<TContext>>
      | ObjectTypeComposerFieldConfigDefinition<TSource, TContext, ArgsMap>
    >
  ): this;

  /**
   * Add new fields or replace existed in a GraphQL type
   */
  public addFields(newFields: ObjectTypeComposerFieldConfigMapDefinition<TSource, TContext>): this;

  /**
   * Add new fields or replace existed (where field name may have dots)
   */
  public addNestedFields(
    newFields: ObjectTypeComposerFieldConfigMapDefinition<TSource, TContext>
  ): this;

  public removeField(fieldNameOrArray: string | string[]): this;

  public removeOtherFields(fieldNameOrArray: string | string[]): this;

  public reorderFields(names: string[]): this;

  public extendField(
    fieldName: string,
    partialFieldConfig: Partial<
      ObjectTypeComposerFieldConfigAsObjectDefinition<TSource, TContext, ArgsMap>
    >
  ): this;

  public getFieldConfig(fieldName: string): GraphQLFieldConfig<TSource, TContext>;

  public getFieldType(fieldName: string): GraphQLOutputType;

  public getFieldTypeName(fieldName: string): string;

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
  public getFieldTC(fieldName: string): ComposeNamedOutputType<TContext>;

  /**
   * Alias for `getFieldTC()` but returns statically checked ObjectTypeComposer.
   * If field have other type then error will be thrown.
   */
  public getFieldOTC(fieldName: string): ObjectTypeComposer<TSource, TContext>;

  public isFieldNonNull(fieldName: string): boolean;

  public makeFieldNonNull(fieldNameOrArray: string | string[]): this;

  public makeFieldNullable(fieldNameOrArray: string | string[]): this;

  public isFieldPlural(fieldName: string): boolean;

  public makeFieldPlural(fieldNameOrArray: string | string[]): this;

  public makeFieldNonPlural(fieldNameOrArray: string | string[]): this;

  public deprecateFields(fields: { [fieldName: string]: string } | string[] | string): this;

  /**
   * -----------------------------------------------
   * Field Args methods
   * -----------------------------------------------
   */

  public getFieldArgs<TArgs = ArgsMap>(
    fieldName: string
  ): ObjectTypeComposerArgumentConfigMap<TArgs>;

  public getFieldArgNames(fieldName: string): string[];

  public hasFieldArg(fieldName: string, argName: string): boolean;

  public getFieldArg(fieldName: string, argName: string): ObjectTypeComposerArgumentConfig;

  public getFieldArgType(fieldName: string, argName: string): GraphQLInputType;

  public getFieldArgTypeName(fieldName: string, argName: string): string;

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
  public getFieldArgTC(fieldName: string, argName: string): ComposeNamedInputType<TContext>;

  /**
   * Alias for `getFieldArgTC()` but returns statically checked InputTypeComposer.
   * If field have other type then error will be thrown.
   */
  public getFieldArgITC(fieldName: string, argName: string): InputTypeComposer<TContext>;

  public setFieldArgs(
    fieldName: string,
    args: ObjectTypeComposerArgumentConfigMapDefinition<any>
  ): this;

  public addFieldArgs(
    fieldName: string,
    newArgs: ObjectTypeComposerArgumentConfigMapDefinition<any>
  ): this;

  public setFieldArg(
    fieldName: string,
    argName: string,
    argConfig: ObjectTypeComposerArgumentConfigDefinition
  ): this;

  public removeFieldArg(fieldName: string, argNameOrArray: string | string[]): this;

  public removeFieldOtherArgs(fieldName: string, argNameOrArray: string | string[]): this;

  public isFieldArgPlural(fieldName: string, argName: string): boolean;

  public makeFieldArgPlural(fieldName: string, argNameOrArray: string | string[]): this;

  public makeFieldArgNonPlural(fieldName: string, argNameOrArray: string | string[]): this;

  public isFieldArgNonNull(fieldName: string, argName: string): boolean;

  public makeFieldArgNonNull(fieldName: string, argNameOrArray: string | string[]): this;

  public makeFieldArgNullable(fieldName: string, argNameOrArray: string | string[]): this;

  /**
   * -----------------------------------------------
   * Type methods
   * -----------------------------------------------
   */

  public getType(): GraphQLObjectType;

  public getTypePlural(): ListComposer<this>;

  public getTypeNonNull(): NonNullComposer<this>;

  public getTypeName(): string;

  public setTypeName(name: string): this;

  public getDescription(): string;

  public setDescription(description: string): this;

  /**
   * You may clone this type with a new provided name as string.
   * Or you may provide a new TypeComposer which will get all clonned
   * settings from this type.
   */
  public clone<TCloneSource = TSource>(
    newTypeNameOrTC: string | ObjectTypeComposer<any, any>
  ): ObjectTypeComposer<TCloneSource, TContext>;

  public getIsTypeOf(): GraphQLIsTypeOfFn<TSource, TContext> | null | void;

  public setIsTypeOf(fn: GraphQLIsTypeOfFn<any, any> | null | void): this;

  /**
   * Merge fields and interfaces from provided `GraphQLObjectType`, or `ObjectTypeComposer`.
   * Also you may provide `GraphQLInterfaceType` or `InterfaceTypeComposer` for adding fields.
   */
  public merge(
    type:
      | GraphQLObjectType
      | GraphQLInterfaceType
      | ObjectTypeComposer<any, any>
      | InterfaceTypeComposer<any, any>
  ): this;

  /**
   * -----------------------------------------------
   * InputType methods
   * -----------------------------------------------
   */

  public getInputType(): GraphQLInputObjectType;

  public hasInputTypeComposer(): boolean;

  public setInputTypeComposer(itc: InputTypeComposer<TContext>): this;

  public getInputTypeComposer(): InputTypeComposer<TContext>;

  public getITC(): InputTypeComposer<TContext>;

  public removeInputTypeComposer(): this;

  /**
   * -----------------------------------------------
   * Resolver methods
   * -----------------------------------------------
   */

  public getResolvers(): Map<string, Resolver<any, TContext, any>>;

  public hasResolver(name: string): boolean;

  /**
   * Returns existed Resolver by name.
   *
   * Resolver may be additionally wrapped by middlewares. Eg:
   *
   * @example
   *     async function authMiddleware(resolve, source, args, context, info) {
   *       if (somehowCheckAuthInContext(context)) {
   *         return resolve(source, args, context, info);
   *       }
   *       throw new Error('You must be authorized');
   *     }
   *
   *     schemaComposer.Query.addFields({
   *       userById: UserTC.getResolver('findById', [authMiddleware]),
   *       userByIds: UserTC.getResolver('findByIds', [authMiddleware]),
   *     });
   *
   * @param name
   * @param middlewares type ResolverMiddleware = (resolve, source, args, context, info) => any;
   */
  public getResolver<TResolverSource = any, TArgs = ArgsMap>(
    name: string,
    middlewares?: Array<ResolverMiddleware<TResolverSource, TContext, TArgs>>
  ): Resolver<TResolverSource, TContext, TArgs>;

  public setResolver<TResolverSource = any, TArgs = ArgsMap>(
    name: string,
    resolver: Resolver<TResolverSource, TContext, TArgs>
  ): this;

  public addResolver<TResolverSource = any, TArgs = ArgsMap>(
    opts:
      | Resolver<TResolverSource, TContext, TArgs>
      | ResolverDefinition<TResolverSource, TContext, TArgs>
  ): this;

  public removeResolver(resolverName: string): this;

  public wrapResolver<TResolverSource = any, TArgs = ArgsMap>(
    resolverName: string,
    cbResolver: ResolverWrapCb<TResolverSource, TSource, TContext, TArgs>
  ): this;

  public wrapResolverAs<TResolverSource = any, TArgs = ArgsMap>(
    resolverName: string,
    fromResolverName: string,
    cbResolver: ResolverWrapCb<TResolverSource, TSource, TContext, TArgs>
  ): this;

  public wrapResolverResolve<TResolverSource = any, TArgs = ArgsMap>(
    resolverName: string,
    cbNextRp: ResolverNextRpCb<TResolverSource, TContext, TArgs>
  ): this;

  /**
   * -----------------------------------------------
   * Interface methods
   * -----------------------------------------------
   */

  public getInterfaces(): Array<InterfaceTypeComposerThunked<TSource, TContext>>;

  public setInterfaces(
    interfaces: ReadonlyArray<InterfaceTypeComposerDefinition<any, TContext>>
  ): this;

  public hasInterface(iface: InterfaceTypeComposerDefinition<any, TContext>): boolean;

  public addInterface(
    iface:
      | InterfaceTypeComposerDefinition<any, TContext>
      | InterfaceTypeComposerThunked<any, TContext>
  ): this;

  public addInterfaces(
    ifaces: ReadonlyArray<
      InterfaceTypeComposerDefinition<any, TContext> | InterfaceTypeComposerThunked<any, TContext>
    >
  ): ObjectTypeComposer<TSource, TContext>;

  public removeInterface(iface: InterfaceTypeComposerDefinition<any, TContext>): this;

  /**
   * -----------------------------------------------
   * Extensions methods
   * -----------------------------------------------
   */

  public getExtensions(): Extensions;

  public setExtensions(extensions: Extensions): this;

  public extendExtensions(extensions: Extensions): this;

  public clearExtensions(): this;

  public getExtension(extensionName: string): any;

  public hasExtension(extensionName: string): boolean;

  public setExtension(extensionName: string, value: any): this;

  public removeExtension(extensionName: string): this;

  public getFieldExtensions(fieldName: string): Extensions;

  public setFieldExtensions(fieldName: string, extensions: Extensions): this;

  public extendFieldExtensions(fieldName: string, extensions: Extensions): this;

  public clearFieldExtensions(fieldName: string): this;

  public getFieldExtension(fieldName: string, extensionName: string): any;

  public hasFieldExtension(fieldName: string, extensionName: string): boolean;

  public setFieldExtension(fieldName: string, extensionName: string, value: any): this;

  public removeFieldExtension(fieldName: string, extensionName: string): this;

  public getFieldArgExtensions(fieldName: string, argName: string): Extensions;

  public setFieldArgExtensions(fieldName: string, argName: string, extensions: Extensions): this;

  public extendFieldArgExtensions(fieldName: string, argName: string, extensions: Extensions): this;

  public clearFieldArgExtensions(fieldName: string, argName: string): this;

  public getFieldArgExtension(fieldName: string, argName: string, extensionName: string): any;

  public hasFieldArgExtension(fieldName: string, argName: string, extensionName: string): boolean;

  public setFieldArgExtension(
    fieldName: string,
    argName: string,
    extensionName: string,
    value: any
  ): this;

  public removeFieldArgExtension(fieldName: string, argName: string, extensionName: string): this;

  /**
   * -----------------------------------------------
   * Directive methods
   *
   * Directive methods are usefull if you declare your schemas via SDL.
   * Users who actively use `graphql-tools` can open new abilities for writing
   * your own directive handlers.
   *
   * If you create your schemas via config objects, then probably you
   * no need in `directives`. Instead directives better to use `extensions`.
   * -----------------------------------------------
   */

  public getDirectives(): ExtensionsDirective[];

  public getDirectiveNames(): string[];

  public getDirectiveByName(directiveName: string): DirectiveArgs | void;

  public getDirectiveById(idx: number): DirectiveArgs | void;

  public getFieldDirectives(fieldName: string): ExtensionsDirective[];

  public getFieldDirectiveNames(fieldName: string): string[];

  public getFieldDirectiveByName(fieldName: string, directiveName: string): DirectiveArgs | void;

  public getFieldDirectiveById(fieldName: string, idx: number): DirectiveArgs | void;

  public getFieldArgDirectives(fieldName: string, argName: string): ExtensionsDirective[];

  public getFieldArgDirectiveNames(fieldName: string, argName: string): string[];

  public getFieldArgDirectiveByName(
    fieldName: string,
    argName: string,
    directiveName: string
  ): DirectiveArgs | void;

  public getFieldArgDirectiveById(
    fieldName: string,
    argName: string,
    idx: number
  ): DirectiveArgs | void;

  /**
   * -----------------------------------------------
   * Misc methods
   * -----------------------------------------------
   */

  public addRelation<TRelationSource = any, TArgs = ArgsMap>(
    fieldName: string,
    ObjectTypeComposerRelationOpts: Readonly<
      ObjectTypeComposerRelationOpts<TRelationSource, TSource, TContext, TArgs>
    >
  ): this;

  public getRelations(): ObjectTypeComposerRelationThunkMap<any, TContext>;

  public setRecordIdFn(fn: ObjectTypeComposerGetRecordIdFn<TSource, TContext>): this;

  public hasRecordIdFn(): boolean;

  public getRecordIdFn(): ObjectTypeComposerGetRecordIdFn<TSource, TContext>;

  /**
   * Get function that returns record id, from provided object.
   */
  public getRecordId(source: TSource, args?: ArgsMap, context?: TContext): string | number;

  public get(path: string | string[]): TypeInPath<TContext> | void;
}
