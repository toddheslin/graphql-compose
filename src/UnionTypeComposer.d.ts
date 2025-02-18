import {
  GraphQLUnionType,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLTypeResolver,
} from 'graphql';
import { SchemaComposer } from './SchemaComposer';
import {
  ObjectTypeComposerThunked,
  ObjectTypeComposerFieldConfig,
  ObjectTypeComposerFieldConfigMap,
  ObjectTypeComposerDefinition,
  ObjectTypeComposer,
} from './ObjectTypeComposer';
import { ListComposer } from './ListComposer';
import { NonNullComposer } from './NonNullComposer';
import { ThunkComposer } from './ThunkComposer';
import { TypeAsString, TypeDefinitionString } from './TypeMapper';
import {
  Thunk,
  Extensions,
  MaybePromise,
  ExtensionsDirective,
  DirectiveArgs,
} from './utils/definitions';

export type UnionTypeComposerDefinition<TSource, TContext> =
  | TypeAsString
  | TypeDefinitionString
  | UnionTypeComposerAsObjectDefinition<TSource, TContext>
  | GraphQLUnionType;

export type UnionTypeComposerAsObjectDefinition<TSource, TContext> = {
  name: string;
  types?: Thunk<ReadonlyArray<ObjectTypeComposerDefinition<any, TContext>> | null>;
  resolveType?: GraphQLTypeResolver<TSource, TContext> | null;
  description?: string | null;
  extensions?: Extensions;
};

export type UnionTypeComposerResolversMap<TSource, TContext> = Map<
  ObjectTypeComposerThunked<TSource, TContext>,
  UnionTypeComposerResolverCheckFn<TSource, TContext>
>;

export type UnionTypeComposerResolversMapDefinition<TSource, TContext> =
  | Map<
      ObjectTypeComposerThunked<any, TContext> | ObjectTypeComposerDefinition<any, TContext>,
      UnionTypeComposerResolverCheckFn<TSource, TContext>
    >
  | Readonly<UnionTypeComposerResolversMap<TSource, TContext>>;

export type UnionTypeComposerResolverCheckFn<TSource, TContext> = (
  value: TSource,
  context: TContext,
  info: GraphQLResolveInfo
) => MaybePromise<boolean | null | void>;

export type UnionTypeComposerThunked<TReturn, TContext> =
  | UnionTypeComposer<TReturn, TContext>
  | ThunkComposer<UnionTypeComposer<TReturn, TContext>, GraphQLUnionType>;

/**
 * Class that helps to create `UnionTypeComposer`s and provide ability to modify them.
 */
export class UnionTypeComposer<TSource = any, TContext = any> {
  public schemaComposer: SchemaComposer<TContext>;
  protected _gqType: GraphQLUnionType;
  protected _gqcTypeMap: Map<string, ObjectTypeComposerThunked<any, TContext>>;
  protected _gqcTypeResolvers: UnionTypeComposerResolversMap<TSource, TContext>;
  protected _gqcExtensions: Extensions | void;

  constructor(graphqlType: GraphQLUnionType, schemaComposer: SchemaComposer<TContext>);

  /**
   * Create `UnionTypeComposer` with adding it by name to the `SchemaComposer`.
   */
  public static create<TSrc = any, TCtx = any>(
    typeDef: UnionTypeComposerDefinition<TSrc, TCtx>,
    schemaComposer: SchemaComposer<TCtx>
  ): UnionTypeComposer<TSrc, TCtx>;

  /**
   * Create `UnionTypeComposer` without adding it to the `SchemaComposer`. This method may be usefull in plugins, when you need to create type temporary.
   */
  public static createTemp<TSrc = any, TCtx = any>(
    typeDef: UnionTypeComposerDefinition<TSrc, TCtx>,
    schemaComposer?: SchemaComposer<TCtx>
  ): UnionTypeComposer<TSrc, TCtx>;

  /**
   * -----------------------------------------------
   * Union Types methods
   * -----------------------------------------------
   */

  public hasType(name: ObjectTypeComposerDefinition<any, TContext>): boolean;

  public getTypes(): Array<ObjectTypeComposerThunked<TSource, TContext>>;

  public getTypeNames(): string[];

  public clearTypes(): this;

  public setTypes(
    types: ReadonlyArray<
      ObjectTypeComposerThunked<TSource, TContext> | ObjectTypeComposerDefinition<any, TContext>
    >
  ): this;

  public addType(
    type: ObjectTypeComposerThunked<any, TContext> | ObjectTypeComposerDefinition<any, TContext>
  ): this;

  public addTypes(
    types: ReadonlyArray<
      ObjectTypeComposerThunked<any, TContext> | ObjectTypeComposerDefinition<any, TContext>
    >
  ): this;

  public removeType(nameOrArray: string | string[]): this;

  public removeOtherTypes(nameOrArray: string | string[]): this;

  /**
   * -----------------------------------------------
   * Type methods
   * -----------------------------------------------
   */

  public getType(): GraphQLUnionType;

  public getTypePlural(): ListComposer<UnionTypeComposer<TSource, TContext>>;

  public getTypeNonNull(): NonNullComposer<UnionTypeComposer<TSource, TContext>>;

  public getTypeName(): string;

  public setTypeName(name: string): this;

  public getDescription(): string;

  public setDescription(description: string): this;

  /**
   * You may clone this type with a new provided name as string.
   * Or you may provide a new TypeComposer which will get all clonned
   * settings from this type.
   */
  public clone(
    newTypeNameOrTC: string | UnionTypeComposer<any, any>
  ): UnionTypeComposer<TSource, TContext>;

  public merge(type: GraphQLUnionType | UnionTypeComposer<any, any>): this;

  /**
   * -----------------------------------------------
   * ResolveType methods
   * -----------------------------------------------
   */

  public getResolveType(): GraphQLTypeResolver<TSource, TContext> | void | null;

  public setResolveType(fn: GraphQLTypeResolver<TSource, TContext> | void | null): this;

  public hasTypeResolver(
    type: ObjectTypeComposerThunked<any, TContext> | ObjectTypeComposerDefinition<any, TContext>
  ): boolean;

  public getTypeResolvers(): UnionTypeComposerResolversMap<TSource, TContext>;

  public getTypeResolverCheckFn(
    type: ObjectTypeComposerThunked<any, TContext> | ObjectTypeComposerDefinition<any, TContext>
  ): UnionTypeComposerResolverCheckFn<any, TContext>;

  public getTypeResolverNames(): string[];

  public getTypeResolverTypes(): Array<ObjectTypeComposerThunked<any, TContext>>;

  public setTypeResolvers(
    typeResolversMap: UnionTypeComposerResolversMapDefinition<TSource, TContext>
  ): this;

  public addTypeResolver(
    type: ObjectTypeComposerDefinition<any, TContext>,
    checkFn: UnionTypeComposerResolverCheckFn<TSource, TContext>
  ): this;

  public removeTypeResolver(type: ObjectTypeComposer<any, TContext> | GraphQLObjectType): this;

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

  /**
   * -----------------------------------------------
   * Directive methods
   * -----------------------------------------------
   */

  public getDirectives(): ExtensionsDirective[];

  public getDirectiveNames(): string[];

  public getDirectiveByName(directiveName: string): DirectiveArgs | void;

  public getDirectiveById(idx: number): DirectiveArgs | void;

  /**
   * -----------------------------------------------
   * Misc methods
   * -----------------------------------------------
   */
}
